# State lives in S3. The bucket was created once by hand, outside Terraform:
#
#   aws s3api create-bucket --bucket matthewvandoff-com-tfstate --region us-east-1
#   aws s3api put-bucket-versioning --bucket matthewvandoff-com-tfstate \
#     --versioning-configuration Status=Enabled
#   aws s3api put-public-access-block --bucket matthewvandoff-com-tfstate \
#     --public-access-block-configuration \
#     BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
terraform {
  backend "s3" {
    bucket       = "matthewvandoff-com-tfstate"
    key          = "v3/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
