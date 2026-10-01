export const websiteEmailFixtures = {
  header: `
    <header>
      <span data-tco-field-id="domainEmail" class="fr-enterprise-field">
        wecare@franklindownsfuneralhome.test
      </span>
    </header>
  `,
  footer: `
    <main>Welcome to Oakdale Plumbing.</main>
    <footer>Questions? hello@oakdaleplumbing.test</footer>
  `,
  form: `
    <form action="/contact">
      <b>careers@franklindownsfuneralhome.test</b>
    </form>
  `,
  mailto: '<a href="mailto:office@northside.test?subject=Hello">Email us</a>',
  scriptNoiseWithMailto: '<script>const address = "content_library.global.email.randcshop@gmail.com";</script><a href="mailto:randcshop@gmail.com">Email us</a>',
  wixTechnicalEmail: '<a href="mailto:605a7baede844d278b89dc95ae0a9123@sentry-next.wixpress.com">System mail</a>',
  placeholderEmail: '<a href="mailto:mymail@mailservice.com">Contact</a>',
  encoded: '<p>hello&#64;riverbank&#46;test</p>',
  noEmail: '<main><h1>Example Business</h1><a href="/directions">Directions</a></main>',
  homepageWithLabeledLink: '<a href="/careers/careers"><span>Contact our team</span></a>',
  careersPage: '<section><b>wecare@franklindownsfuneralhome.test</b></section>',
};
