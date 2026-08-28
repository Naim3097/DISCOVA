-- DISCOVA · Stage 1 — fixture: the real Takaful Solutions audit (20 Aug 2026)
-- Hand-encoded from the manual audit so the UI is built against real data.

with r as (
  insert into runs (domain, tier, framework_version, status, started_at, finished_at, scores)
  values (
    'takafulsolutions.com', 'audit', '2.2', 'done',
    '2026-08-20T03:00:00Z', '2026-08-20T03:03:00Z',
    '{
      "overall": 54,
      "band": "Developing",
      "areas": [
        {"key":"google_visibility","label":"Google Visibility","score":47,"status":"Needs improvement","note":"Well targeted, but one page can only compete for one kind of search."},
        {"key":"website_content","label":"Website Content","score":45,"status":"Needs improvement","note":"Your weakest area. Three products are named; none is explained."},
        {"key":"user_experience","label":"User Experience","score":81,"status":"Good","note":"Every enquiry button opens WhatsApp with the right question already written."},
        {"key":"technical_foundation","label":"Technical Foundation","score":56,"status":"Fair","note":"Properly set up, but slow to respond and living at two addresses at once."},
        {"key":"local_search","label":"Local Search","score":58,"status":"Fair","note":"Petaling Jaya is named and correctly marked up for Google."},
        {"key":"design_brand","label":"Design & Brand","score":81,"status":"Good","note":"Your strongest area, and the best design result we have recorded."}
      ],
      "design_subscores": [
        {"area":"Imagery & Assets","points":4,"max":5,"note":"A sharp, professional photograph of a real consultant - but it is the only image on the site."},
        {"area":"Typography","points":4,"max":4,"note":"A full pass. One well-chosen typeface, clear hierarchy, nothing shouting."},
        {"area":"Colour & Brand","points":4.5,"max":5,"note":"A disciplined navy and teal that anyone would remember; five button styles is a few too many."},
        {"area":"Hero Section","points":4,"max":5,"note":"Static, calm and readable, with a person in it. Two buttons where one would land harder."},
        {"area":"Layout & Consistency","points":3,"max":5,"note":"Sound buyer order, but recruitment sits in front of the sell and there is no proof section at all."}
      ],
      "design_total": {"points": 19.5, "max": 24},
      "strengths": [
        "Every enquiry button opens WhatsApp with a contextual pre-filled message - better than any other site reviewed",
        "One typeface (Inter) used consistently with clear hierarchy; nothing shouting",
        "A disciplined navy-and-teal identity anyone would remember",
        "Petaling Jaya named, with FinancialService and PostalAddress markup correctly in place"
      ],
      "clearest_gap": {
        "label_a": "Products you advise on", "sub_a": "medical card, hibah, critical illness", "value_a": 3,
        "label_b": "Pages explaining them",  "sub_b": "that someone researching can find",   "value_b": 0,
        "note": "Nobody buys takaful on impulse. They search what hibah means, what a medical card covers, and what happens if they claim - and none of those searches can currently find you."
      }
    }'::jsonb
  )
  returning id
)
insert into findings
  (run_id, check_id, category, severity, title, evidence, evidence_label, verification,
   confidence, reach, internal_detail, client_summary, effort, score_impact)
select r.id, f.* from r, (values
  ('content-product-pages','Content & Topical Authority','high',
   'Three products named, none explained',
   'Medical Card, Hibah Takaful and Critical Illness appear as cards on a single-page site (791 words total); no product has a page.',
   'verified','rendered_dom',1.0,'high',
   'Build /medical-card, /hibah-takaful and /critical-illness pages, 800-1200 words each, answering the research questions people search before choosing an adviser.',
   'Nobody buys takaful on impulse. The questions people research before choosing an adviser currently have no page to land on.',
   'medium',-15),
  ('onpage-single-page','Keyword & Search Opportunity','high',
   'One page competes for every search',
   'Sitemap contains exactly one URL; every service shares the homepage.',
   'verified','raw_html',1.0,'high',
   'Each distinct search need requires its own indexable URL; see product-page finding for the initial set.',
   'A single page can only compete for one kind of search, however good it is.',
   'medium',-15),
  ('content-no-proof','Content & Topical Authority','high',
   'No proof anywhere - no testimonials, licence, or track record',
   'Rendered text contains no testimonial, client name, licence number or years-in-practice.',
   'verified','rendered_dom',1.0,'high',
   'Add adviser credentials (licence no., years licensed) and 2-3 named client testimonials with permission.',
   'There is nowhere a visitor can see that anyone has trusted you before. For a decision this personal, that is the missing piece.',
   'medium',-15),
  ('tech-dual-host','Technical SEO','medium',
   'Site answers at two addresses with no redirect',
   'takafulsolutions.com and www.takafulsolutions.com both return 200 with zero redirects; canonical points at www while apex serves identical content.',
   'verified','raw_html',1.0,'high',
   'Pick one host and 301 the other to it at the edge; align the canonical tag with the chosen host.',
   'Your site exists at two addresses at once, so Google has to guess which is real - and the value splits between them.',
   'quick_win',-8),
  ('tech-caching','Technical SEO','medium',
   'Caching disabled; slow first response',
   'Cache-Control: public,max-age=0,must-revalidate on all assets; TTFB 0.73-0.76s across three runs.',
   'verified','raw_html',1.0,'high',
   'Serve hashed static assets with long-lived immutable caching; add CDN or page caching; target TTFB under 300ms.',
   'Pages take noticeably longer to start loading than they should, and nothing is stored for repeat visitors.',
   'low',-8),
  ('serp-share-preview','SERP Visibility','medium',
   'No social share preview card',
   'Zero og: and twitter: meta tags on a business whose funnel runs through WhatsApp sharing.',
   'verified','raw_html',1.0,'medium',
   'Add Open Graph and Twitter tags with a branded share image; test with a WhatsApp share.',
   'When your link is shared on WhatsApp, no preview card appears - every share is less persuasive than it should be.',
   'quick_win',-8),
  ('local-gbp','Local SEO','medium',
   'Google Business Profile could not be confirmed',
   'No GBP found in searches; requires owner confirmation to verify either way.',
   'not_testable','none',1.0,'medium',
   'Confirm with client; if absent, create and verify a GBP for the Petaling Jaya service area.',
   'Whether you appear on the Google map for advisers near you could not be confirmed from outside.',
   'low',-8),
  ('ux-recruitment-order','SEO UX & Conversion','low',
   'Recruitment section sits before the closing call to action',
   'Section order: products, process, agent recruitment, FAQ, contact - hiring interrupts the buyer path.',
   'verified','rendered_dom',1.0,'medium',
   'Move recruitment below the final CTA or onto its own page.',
   'Someone weighing protection for their family meets a job advert before they reach your closing message.',
   'quick_win',-3),
  ('design-single-image','Design & Brand','medium',
   'Only one photograph on the entire site',
   'One image total: syakira-ramran-agent.webp (600x900 studio portrait, professionally shot, correctly labelled).',
   'verified','image_review',1.0,'medium',
   'Add 3-5 real photos: consultations in progress, the adviser with clients (with permission), the office.',
   'One professional photo carries the whole brand; the sessions and people behind it have no visual presence.',
   'medium',0),
  ('design-button-sprawl','Design & Brand','low',
   'Five button styles for a handful of actions',
   'btn-primary, btn-secondary, btn-light, btn-dark full and nav-cta all present; two buttons compete in the hero.',
   'verified','rendered_dom',1.0,'low',
   'Consolidate to one primary and one secondary style; single CTA in the hero.',
   'Small inconsistencies in buttons make choosing feel harder than it should at the moment of action.',
   'quick_win',0)
) as f(check_id, category, severity, title, evidence, evidence_label, verification,
       confidence, reach, internal_detail, client_summary, effort, score_impact);
