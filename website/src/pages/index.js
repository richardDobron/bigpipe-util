import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import CodeBlock from "@theme/CodeBlock";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./styles.module.css";

const examples = [
  {
    id: "primer",
    label: "Primer",
    client: {
      language: "html",
      title: "HTML",
      code: `<ul class="cart">
  <li id="item-123">
    Headphones
    <a href="#"
       ajaxify="/ajax/remove.php?id=123"
       rel="async">Remove</a>
  </li>
</ul>`,
    },
    server: `<?php
// /ajax/remove.php
$response = new \\dobron\\BigPipe\\AsyncResponse();

$response->remove('#item-' . $_GET['id']);
$response->appendContent(
    'ul.cart',
    '<li>Item removed.</li>'
);

$response->send();`,
    note: (
      <>
        The <Link to="/docs/primer">Primer</Link> handles links and forms with <code>rel="async"</code>. The
        server answers with DOM operations and they're applied for you.
      </>
    ),
  },
  {
    id: "request",
    label: "AsyncRequest",
    client: {
      language: "javascript",
      title: "JavaScript",
      code: `import AsyncRequest from 'bigpipe-util/dist/async/AsyncRequest';

new AsyncRequest('/ajax/username.php')
  .setData({ username: 'john.doe' })
  .setHandler(({ payload }) => {
    console.log(payload.available);
  })
  .send();`,
    },
    server: `<?php
// /ajax/username.php
$response = new \\dobron\\BigPipe\\AsyncResponse();

$available = !User::exists($_POST['username']);

$response->setPayload(['available' => $available]);
$response->setContent(
    '#username-status',
    $available ? 'Available' : 'Taken'
);

$response->send();`,
    note: (
      <>
        Send requests from your code with <Link to="/docs/async_request">AsyncRequest</Link>. DOM operations are
        applied first, then your handler gets the payload.
      </>
    ),
  },
  {
    id: "module",
    label: "Modules",
    client: {
      language: "javascript",
      title: "ChartRenderer.js",
      code: `export default class ChartRenderer {
  render(element, points) {
    // element is the <div id="chart">,
    // points is a Map
  }
}`,
    },
    server: `<?php
use dobron\\BigPipe\\TransportMarker;

$response->bigPipe()->require(
    "require('ChartRenderer').render()",
    [
        TransportMarker::transportElement('chart'),
        TransportMarker::transportMap($points),
    ]
);`,
    note: (
      <>
        <Link to="/docs/server_js">ServerJS</Link> calls the modules the server asks for. Transport markers turn
        arguments into elements, maps, sets or other modules.
      </>
    ),
  },
  {
    id: "dialog",
    label: "Dialogs",
    client: {
      language: "javascript",
      title: "ModalLogger.js",
      code: `export default class ModalLogger {
  constructor(modal) {
    modal.on('shown', () => console.log('shown'));
    modal.on('hidden', () => console.log('hidden'));
  }
}`,
    },
    server: `<?php
$response = new \\dobron\\BigPipe\\DialogResponse();

$response->setTitle('Dialog title')
    ->setController("require('ModalLogger')")
    ->setBody('html <strong>content</strong>')
    ->dialog();

$response->send();`,
    note: (
      <>
        <Link to="/docs/dialog">Dialogs</Link> are rendered on the server and can be stacked. A controller reacts to
        their events.
      </>
    ),
  },
];

const features = [
  {
    icon: "⚡",
    title: "Primer",
    description: (
      <>
        Make links and forms asynchronous with <code>rel="async"</code>, with loading states and protection against
        double submits.
      </>
    ),
  },
  {
    icon: "🛜",
    title: "AsyncRequest",
    description: (
      <>A chainable request API that applies the response for you and gives your handler the payload.</>
    ),
  },
  {
    icon: "🧩",
    title: "ServerJS",
    description: (
      <>
        Let the server call your modules. Arguments can be elements, maps, sets or other modules thanks to transport
        markers.
      </>
    ),
  },
  {
    icon: "🪄",
    title: "DOM utilities",
    description: <>Set, append, prepend, replace or remove content, and find parents by tag, class or attribute.</>,
  },
  {
    icon: "🖥",
    title: "Dialogs & events",
    description: (
      <>
        Stackable, Bootstrap-compatible dialogs with controllers, and <Link to="/docs/arbiter">Arbiter</Link> for
        publish/subscribe between modules.
      </>
    ),
  },
  {
    icon: "🏢",
    title: "Pagelets",
    description: (
      <>
        Inspired by Facebook's BigPipe: <Link to="/docs/pagelets">pagelets</Link> are shown as soon as their CSS is
        loaded and their JavaScript runs once all of them are visible.
      </>
    ),
  },
];

// The layers of the logo (static/img/bigpipe-icon.svg), split to animate each of them.
const logoLayers = [
  "M.749 21.381a1.543 1.543 0 0 1 0-2.646L31.605.221a1.53 1.53 0 0 1 1.588 0L64.05 18.735a1.543 1.543 0 0 1 0 2.646L33.193 39.895a1.54 1.54 0 0 1-1.588 0Z",
  "M62.462 31.078 32.399 49.116 2.337 31.078a1.543 1.543 0 0 0-1.588 2.646l30.856 18.513a1.54 1.54 0 0 0 1.588 0L64.05 33.724a1.543 1.543 0 0 0-1.588-2.646Z",
  "M62.462 43.421 32.399 61.458 2.337 43.421a1.543 1.543 0 0 0-1.588 2.645L31.605 64.58a1.54 1.54 0 0 0 1.588 0L64.05 46.066a1.543 1.543 0 0 0-1.588-2.645Z",
];

function HeroLogo() {
  return (
    <div className={styles.heroLogo} aria-hidden="true">
      <div className={styles.heroGlow} />
      <svg className={styles.heroLogoSvg} viewBox="-4 -10 72.8 84.8">
        {logoLayers.map((d, i) => (
          <g key={i} className={styles.layerDrop} style={{ "--layer": i }}>
            <path className={styles.layer} d={d} />
          </g>
        ))}
      </svg>
    </div>
  );
}

const entrypoint = `import Primer from 'bigpipe-util/dist/Primer';

Primer();

window.require = (modulePath) => {
  return modulePath.startsWith('bigpipe-util/')
    ? require('bigpipe-util/dist/' + modulePath.replace(/^bigpipe-util\\/(src|dist)\\//, '') + '.js').default
    : require('./' + modulePath).default;
};`;

function Hero() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <header className={styles.hero}>
      <div className={clsx("container", styles.heroContainer)}>
        <div className={styles.heroText}>
          <span className={styles.badge}>The JavaScript runtime of BigPipe</span>
          <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
          <p className={styles.heroTagline}>
            Apply what the server responds with: DOM operations, JavaScript modules, dialogs and pagelets. Your
            frontend stays small, your backend stays in control.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/getting_started">
              Get started
            </Link>
            <Link
              className="button button--outline button--secondary button--lg"
              to="https://richarddobron.github.io/bigpipe-php/"
            >
              PHP docs
            </Link>
          </div>
          <div className={styles.install}>
            <CodeBlock language="bash">npm install bigpipe-util</CodeBlock>
          </div>
        </div>
        <HeroLogo />
      </div>
    </header>
  );
}

function InAction() {
  return (
    <section className={styles.section}>
      <div className="container">
        <h2 className={styles.sectionTitle}>BigPipe in action</h2>
        <p className={styles.sectionLead}>
          The server decides what happens, <code>bigpipe-util</code> makes it happen in the browser.
        </p>
        <Tabs className={styles.exampleTabs}>
          {examples.map(({ id, label, client, server, note }) => (
            <TabItem key={id} value={id} label={label}>
              <div className="row">
                <div className="col col--6">
                  <CodeBlock language={client.language} title={client.title}>
                    {client.code}
                  </CodeBlock>
                  <p className={styles.exampleNote}>{note}</p>
                </div>
                <div className="col col--6">
                  <CodeBlock language="php" title="PHP">
                    {server}
                  </CodeBlock>
                </div>
              </div>
            </TabItem>
          ))}
        </Tabs>
        <p className={styles.exampleFootnote}>
          See all of them working in the <a href="http://bigpipe.xf.cz">demo app</a>.
        </p>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <h2 className={styles.sectionTitle}>What's inside</h2>
        <p className={styles.sectionLead}>
          Small, dependency-light modules. Use the ones you need, directly or through the server.
        </p>
        <div className={styles.featureGrid}>
          {features.map(({ icon, title, description }) => (
            <div key={title} className={styles.featureCard}>
              <div className={styles.featureIcon} aria-hidden="true">
                {icon}
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section className={styles.section}>
      <div className={clsx("container", styles.narrow)}>
        <h2 className={styles.sectionTitle}>Get started in minutes</h2>
        <p className={styles.sectionLead}>Install the package and wire it up in your entrypoint and layout.</p>
        <CodeBlock language="bash" title="Terminal">
          npm install bigpipe-util
        </CodeBlock>
        <CodeBlock language="javascript" title="resources/js/app.js">
          {entrypoint}
        </CodeBlock>
        <CodeBlock language="php" title="Page footer">{`<script>
    (new (require("bigpipe-util/src/ServerJS"))).handle(<?=json_encode(\\dobron\\BigPipe\\BigPipe::jsmods())?>);
</script>`}</CodeBlock>
        <p className={styles.center}>
          <Link to="/docs/getting_started">Read the full guide →</Link>
        </p>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <Hero />
      <main>
        <InAction />
        <Features />
        <GetStarted />
      </main>
    </Layout>
  );
}
