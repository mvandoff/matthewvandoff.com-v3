# www points straight at v3's distribution. The hand-made wildcard record
# (*.matthewvandoff.com, still aimed at v2's distribution) stays as it is: a
# specific record wins over the wildcard. The apex keeps its own hand-made
# redirect distribution, which 301s to www.
resource "aws_route53_record" "www" {
  for_each = toset(["A", "AAAA"])

  zone_id = data.aws_route53_zone.site.zone_id
  name    = "www.matthewvandoff.com"
  type    = each.key

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
