import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Terms of Service — Mikian.Photos",
};

export default function Page() {
  return (
    <LegalPage title="Terms of service" accent="service" effective="2026-05-27">
      <p>
        Mikian.Photos is operated by Mikian Musser (&ldquo;Mikian,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). By using mikian.photos you agree to these terms. They&rsquo;re short
        on purpose — read them.
      </p>

      <h2>What we sell</h2>
      <p>
        We sell digital photographs taken at running events. After an event, you can search the
        event&rsquo;s photos by face scan or bib number and buy the full set for a single flat
        price displayed on the purchase page. There are no subscriptions, no recurring charges,
        and no hidden fees beyond payment processing.
      </p>

      <h2>What you get</h2>
      <p>
        When your payment settles, we deliver the full-resolution photos that match your search
        to you for download. You receive a <strong>personal-use license</strong> for those
        photos: you can keep them, print them, post them on personal social media, send them to
        friends and family, and use them for personal milestones.
      </p>
      <p>
        You may <strong>not</strong> resell the photos, license them to third parties, use them
        in advertising or paid promotions, train machine-learning models on them, or remove
        photographer attribution that we include with the file.
      </p>

      <h2>Photographer rights</h2>
      <p>
        Every photo carries an attribution to its photographer. Photographers retain copyright
        in their work; Mikian.Photos licenses the photos to you under the personal-use terms
        above. If you&rsquo;re a photographer and want a photo of yours removed, email us at{" "}
        <a href="mailto:hello@mikian.photos">hello@mikian.photos</a>.
      </p>

      <h2>Payment</h2>
      <p>
        Payments are processed by our payment provider (currently Stripe or PayPal — whichever
        is shown at checkout). We don&rsquo;t store your card details. The amount you see on
        the checkout page is the amount charged, including any payment-processor fee disclosed
        on that page.
      </p>

      <h2>Refunds</h2>
      <p>
        Because photos are delivered digitally and immediately, sales are generally final. If
        something went wrong — wrong photos delivered, a download that won&rsquo;t complete, a
        photo of someone who isn&rsquo;t you — email{" "}
        <a href="mailto:hello@mikian.photos">hello@mikian.photos</a> within 14 days of purchase
        and we&rsquo;ll refund you in full, no questions asked.
      </p>

      <h2>If your photos shouldn&rsquo;t be public</h2>
      <p>
        If you appear in a photo we&rsquo;ve published and you want it taken down, email us at{" "}
        <a href="mailto:hello@mikian.photos">hello@mikian.photos</a> with a description of the
        photo (and your bib number if you have one). We&rsquo;ll remove it from public view
        within a few business days.
      </p>

      <h2>Account &amp; downloads</h2>
      <p>
        We may ask you to sign in (e.g. with Google) to access photos you&rsquo;ve already
        bought, view receipts, or re-download. We keep your purchase history so the photos
        you&rsquo;ve paid for stay available to you.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&rsquo;t try to break into the site, scrape the catalog, share your downloads
        publicly in a way that lets others avoid paying, or use the site to harass anyone. We
        may suspend access if you do.
      </p>

      <h2>No warranty</h2>
      <p>
        The service is provided &ldquo;as is.&rdquo; We do our best to keep it working and to
        match the right photos to the right people, but we don&rsquo;t guarantee perfect
        results. If face-matching misses you or a bib is mis-OCR&rsquo;d, contact us and
        we&rsquo;ll make it right.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        Our maximum liability for any claim relating to the service is the amount you paid us
        in the 90 days before the claim arose.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of California, USA. Disputes are
        resolved in the state or federal courts located in Los Angeles County.
      </p>

      <h2>Changes</h2>
      <p>
        If we change these terms in a way that affects you materially, we&rsquo;ll update the
        effective date at the top and (if you have an account) notify you by email. Continued
        use after the effective date means you accept the changes.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, refunds, takedowns, or anything else:{" "}
        <a href="mailto:hello@mikian.photos">hello@mikian.photos</a>.
      </p>
    </LegalPage>
  );
}
