# The last.fm fetcher (ADR 0002, mvd-u5q.6): one Lambda, two schedules, writing
# music/*.json into the site bucket. Build it before planning:
#
#   (cd app && pnpm fetcher:build)

# Matthew created both parameters by hand. They're referenced by name rather than
# managed here, so the key's value never lands in Terraform state.
locals {
  fetcher_name   = "matthewvandoff-com-v3-lastfm-fetcher"
  api_key_param  = "/matthewvandoff-com-v3/lastfm/api-key"
  username_param = "/matthewvandoff-com-v3/lastfm/username"
}

data "aws_caller_identity" "current" {}

data "archive_file" "fetcher" {
  type        = "zip"
  source_file = "${path.module}/../app/dist-fetcher/index.mjs"
  output_path = "${path.module}/.terraform/fetcher.zip"
}

resource "aws_cloudwatch_log_group" "fetcher" {
  name              = "/aws/lambda/${local.fetcher_name}"
  retention_in_days = 14
}

data "aws_iam_policy_document" "fetcher_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "fetcher" {
  name               = local.fetcher_name
  assume_role_policy = data.aws_iam_policy_document.fetcher_trust.json
}

# The SecureString uses the AWS managed aws/ssm key, which needs no kms:Decrypt grant here.
data "aws_iam_policy_document" "fetcher" {
  statement {
    actions = ["ssm:GetParameter"]
    resources = [
      for name in [local.api_key_param, local.username_param] :
      "arn:aws:ssm:us-east-1:${data.aws_caller_identity.current.account_id}:parameter${name}"
    ]
  }

  # ListBucket turns a missing file into NoSuchKey rather than AccessDenied. It can't
  # be narrowed to music/ with s3:prefix: a GetObject carries no prefix to match.
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }

  statement {
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.site.arn}/music/*"]
  }

  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.fetcher.arn}:*"]
  }
}

resource "aws_iam_role_policy" "fetcher" {
  name   = "fetcher"
  role   = aws_iam_role.fetcher.id
  policy = data.aws_iam_policy_document.fetcher.json
}

resource "aws_lambda_function" "fetcher" {
  function_name    = local.fetcher_name
  role             = aws_iam_role.fetcher.arn
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.fetcher.output_path
  source_code_hash = data.archive_file.fetcher.output_base64sha256
  memory_size      = 256
  # A top run is 12 last.fm calls, 3 at a time, each with an 8s timeout.
  timeout = 60

  environment {
    variables = {
      BUCKET         = aws_s3_bucket.site.bucket
      API_KEY_PARAM  = local.api_key_param
      USERNAME_PARAM = local.username_param
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.fetcher.name
  }

  depends_on = [aws_iam_role_policy.fetcher]
}

data "aws_iam_policy_document" "scheduler_trust" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "fetcher_scheduler" {
  name               = "${local.fetcher_name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_trust.json
}

data "aws_iam_policy_document" "fetcher_scheduler" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.fetcher.arn]
  }
}

resource "aws_iam_role_policy" "fetcher_scheduler" {
  name   = "invoke-fetcher"
  role   = aws_iam_role.fetcher_scheduler.id
  policy = data.aws_iam_policy_document.fetcher_scheduler.json
}

# Each run is self-contained and the next one is never far off, so no retries:
# not from Scheduler, and not Lambda's own async retries either.
resource "aws_lambda_function_event_invoke_config" "fetcher" {
  function_name                = aws_lambda_function.fetcher.function_name
  maximum_retry_attempts       = 0
  maximum_event_age_in_seconds = 60
}

resource "aws_scheduler_schedule" "fetcher" {
  for_each = {
    recent = "rate(1 minute)"
    top    = "rate(6 hours)"
  }

  name                = "${local.fetcher_name}-${each.key}"
  schedule_expression = each.value

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.fetcher.arn
    role_arn = aws_iam_role.fetcher_scheduler.arn
    input    = jsonencode({ mode = each.key })

    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
