# Existing resources, read but never managed here (ADR 0001). Don't touch the
# Zoho MX/SPF/DKIM records or the cert's validation CNAME in this zone.

data "aws_route53_zone" "site" {
  zone_id = "Z02231941G7VW184GT2SW"
}

# The wildcard cert: matthewvandoff.com + *.matthewvandoff.com.
data "aws_acm_certificate" "wildcard" {
  domain   = "matthewvandoff.com"
  statuses = ["ISSUED"]
}
