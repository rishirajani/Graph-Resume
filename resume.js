/* resume.js: the public part of Rishi Rajani's resume graph.
   Generated from a private master on every change. Don't edit it here: changes are overwritten. */

window.RESUME = {
  "site": {
    "title": "Rishi Rajani · Resume graph",
    "allowPublicGraphExport": true,
    "baseIri": "https://rishirajani.github.io/Graph-Resume/",
    "goatcounter": "rishirajani",
    "ownerPassphraseSha256": ""
  },
  "person": {
    "id": "me",
    "type": "Person",
    "name": "Rishi Rajani",
    "headline": "Data and knowledge engineer working on semantics, ontologies, data governance and quality",
    "location": "Stuttgart, Germany (open to relocation)",
    "email": "rishirajani078@gmail.com",
    "links": [
      {
        "label": "LinkedIn",
        "url": "https://linkedin.com/in/rishi-rajani-076794109/"
      },
      {
        "label": "GitHub",
        "url": "https://github.com/rishirajani"
      }
    ],
    "summary": "Data and knowledge engineer with approximately three years of experience in fintech and enterprise data, connecting business meaning with reliable data systems. Experienced in defining and documenting shared business metrics, standardizing data models, reconciling heterogeneous sources, and establishing data-quality practices and reporting adopted across business functions. Currently completing an M.Sc. in Computer Science at Universität Stuttgart, specializing in ontology engineering, knowledge graphs, description logics, and machine learning."
  },
  "nodes": [
    {
      "id": "o-nobel",
      "type": "Organization",
      "label": "Nobel Hygiene Pvt. Ltd.",
      "short": "Nobel Hygiene",
      "description": "Manufacturer of adult and baby hygiene products such as diapers and sanitary pads."
    },
    {
      "id": "r-nobel",
      "type": "Role",
      "label": "Data Engineering Consultant",
      "short": "Data Engineering\nConsultant",
      "org": "o-nobel",
      "start": "2023-10",
      "end": "2024-03",
      "location": "Mumbai, India",
      "highlights": [
        "Built a data integration and reporting proof of concept around existing SAP HANA and API services, implementing Python extraction, logging and transformation workflows, PostgreSQL storage, and Docker-hosted Apache Superset dashboards for sales leaders, the CFO and CMO.",
        "Standardized source-to-target field mappings and definitions, corrected duplicate API records, and reconciled delayed secondary-sales figures with manual sales-team reporting alongside primary- and secondary-sales stakeholders.",
        "Automated recurring data extraction and reporting, reducing manual reporting time by approximately 40%; coordinated access to on-premises virtual machines, APIs and data infrastructure.",
        "Developed an Amazon marketplace price tracker comparing company and competitor product listings to support commercial analysis: integrated the Amazon Selling Partner API to record competitor prices daily and the company's own product offers every four hours (buy-box eligibility, fulfilment-channel offer counts, landed prices, seller shipping times), batching requests within API rate limits.",
        "Automated daily ingestion of secondary-sales orders from the sales-force-automation platform's API into the analytics database, with retries, timeouts, saved fetch state for incremental loads, and a request/response log table for auditability.",
        "Packaged these scheduled Python jobs with Poetry and deployed them in a Docker container with cron, writing to Microsoft SQL Server through SQLAlchemy ORM models.",
        "Deployed the company's business-intelligence platform, NHPL BizIntel, on Apache Superset 3.0 with Docker Compose: company branding, a PostgreSQL metadata store with Redis, and database drivers for SAP HANA, SQL Server, MySQL and PostgreSQL.",
        "Built a custom Superset image with Firefox and GeckoDriver so scheduled email reports and alerts could render dashboard screenshots, delivered via Office 365 SMTP; added Prophet for forecasting and enabled native filters, Jinja templating and full CSV export."
      ],
      "skills": [
        "s-python",
        "s-sap",
        "s-postgres",
        "s-docker",
        "s-superset",
        "s-etl",
        "s-integration",
        "s-s2t",
        "s-metricstd",
        "s-reconcile",
        "s-dq",
        "s-stakeholders",
        "s-rest",
        "s-mssql",
        "s-sqlalchemy",
        "s-pandas",
        "s-cron",
        "s-alerting"
      ]
    },
    {
      "id": "o-flexmoney",
      "type": "Organization",
      "label": "Flexmoney Technologies Pvt. Ltd.",
      "short": "Flexmoney",
      "description": "Fintech company that runs InstaCred, a checkout-financing network connecting merchants, lenders and customers. Lenders share pre-approved customer bases, either through API-based pre-approval checks or as encrypted files. At checkout, customers can see which lenders pre-approve them for the cart amount, and some merchants run the check automatically for larger purchases. Customers who aren't pre-approved can open a new credit line with a partner lender."
    },
    {
      "id": "r-flexmoney",
      "type": "Role",
      "label": "Executive – Marketing Analytics (data & analytics engineering)",
      "short": "Executive,\nMarketing Analytics",
      "org": "o-flexmoney",
      "start": "2021-03",
      "end": "2023-03",
      "location": "Mumbai, India",
      "highlights": [
        "Co-defined and documented transaction metrics with merchant-, lender- and product-facing stakeholders, reconciling competing interpretations of customer activity and implementing distinct business perspectives through SQL reporting.",
        "Owned launch-critical analytics for a new lending approval journey, defining multi-stage conversion funnels, writing SQL models and delivering dashboards required for product go-live.",
        "Converted manual Excel-based reporting into scalable Apache Superset dashboards and reusable queries; delivered analytics for six clients across two projects and ran demonstrations to support daily adoption by business and marketing teams.",
        "Built Python ELT pipelines connecting Google and Meta advertising data with website engagement and transaction activity via UTM parameters and session identifiers; analyzed high-volume merchant/product click funnels using CleverTap.",
        "Investigated suspicious transaction patterns associated with inactive merchant storefronts; screened merchant URLs programmatically, coordinated removal of confirmed defunct merchants, and identified duplicates and invalid URLs for master-data cleanup.",
        "Partnered with product and lending stakeholders on funnel improvements contributing to a reported 14–16% reduction in drop-offs; developed operational monitoring and anomaly alerts and briefed senior stakeholders regularly.",
        "Built 20+ dashboards and 20+ automated alert and reporting jobs, including a tracking system for lender API conversions shared in weekly lender calls, hourly business-performance monitoring for the festive season and daily automated MIS for top lenders; merchant, lender and engineering teams relied on them, including for network hygiene.",
        "Built a real-time tracker for lender transaction-API downtime; ahead of the 2022 festive sale, tightened alert definitions and shortened check intervals, and worked with Engineering to route Superset alerts into OpsGenie for on-call engineers.",
        "Created a Lender Report Card comparing lender performance across the network on key metrics, used by the business team in lender conversations.",
        "Optimized data-heavy Superset dashboards to a load success rate above 90% and removed inaccuracies; built trackers for No-Cost EMI offer spend, SMS campaign spend and digital-marketing performance, plus dashboards and MIS reports for new-to-bank lenders.",
        "Made the case, with supporting proof points, for a lending partner to restructure a policy that was rejecting repeat transactions; the change raised repeat rates by 100–150 basis points.",
        "Showed how lowering a lender's minimum transaction amount could grow its share on other merchants and reduce its dependence on its largest marketplace partner, and identified top-performing merchants to target.",
        "Pushed a lender to launch Cardless EMI beyond its largest marketplace partner, cutting one category of rejects from 20% to 5% and lifting success rates by about 10% on average; later encouraged it to restart the programme on other merchants, raising its success rate there by about 5%.",
        "Supplied data that led a lender to loosen its velocity-reject policy, and compared marketplace performance at a lender after a new marketplace launch to help scale it across the network.",
        "Studied users frequently rejected by top-performing lenders and identified segments for whom lender discovery could be disabled, improving API success rates.",
        "Helped create a standard operating process for tracking campaigns across the network, compared Facebook, CleverTap and database data as tracking sources, and tracked festive-season campaigns with CleverTap dashboards.",
        "Generated proof points from the December 2021 digital campaigns that helped improve the growth-hacking campaigns, contributing to over 2.5x growth in campaign activations; set up automated CleverTap journeys for users activating through lender campaigns, converting at about 4% for one lender.",
        "Built customer segments in CleverTap and the database for re-engagement, sale-event and new-to-bank drop-off campaigns, kept CleverTap user-profile data current so segments stayed accurate, and uncovered a backend bug that caused campaigns to reach unintended customers.",
        "Identified gaps in the data and flagged personal information exposed in datasets where it should not have been available.",
        "Analyzed surveys of transacting and ineligible customers to validate the new-to-bank business case and build user personas.",
        "Onboarded new colleagues on the database schema, Athena, Redshift, CleverTap and Superset.",
        "Led a team at the Flexathon 1.0 hackathon pitching Transactions as a Service, letting customers order with Cardless EMI directly from product-page widgets; the team received recognition."
      ],
      "skills": [
        "s-kpi",
        "s-metricstd",
        "s-docs",
        "s-sql",
        "s-python",
        "s-etl",
        "s-superset",
        "s-clevertap",
        "s-funnel",
        "s-attribution",
        "s-kpifw",
        "s-mdm",
        "s-reconcile",
        "s-dq",
        "s-stakeholders",
        "s-requirements",
        "s-enablement",
        "s-athena",
        "s-redshift",
        "s-alerting",
        "s-segment",
        "s-survey",
        "s-privacy"
      ]
    },
    {
      "id": "r-flexmoney-am",
      "type": "Role",
      "label": "Assistant Manager – Marketing Analytics (data & analytics engineering)",
      "short": "Assistant Manager,\nMarketing Analytics",
      "org": "o-flexmoney",
      "promotedFrom": "r-flexmoney",
      "start": "2023-04",
      "end": "2023-08",
      "location": "Mumbai, India",
      "summary": "Promoted from Executive – Marketing Analytics in April 2023, following the FY 2022-23 performance review."
    },
    {
      "id": "o-vmlyr",
      "type": "Organization",
      "label": "VMLY&R (QAIS Consulting Pvt. Ltd.)",
      "short": "VMLY&R"
    },
    {
      "id": "r-vmlyr",
      "type": "Role",
      "label": "Freelance Consultant, Product Outreach",
      "short": "Freelance,\nProduct Outreach",
      "org": "o-vmlyr",
      "start": "2020-08",
      "end": "2020-09",
      "employment": "Freelance, remote",
      "location": "Mumbai, India",
      "highlights": [
        "Researched outreach solutions for a client's product aimed at adult gamers in Japan and Indonesia, working within constraints such as age restrictions and avoiding any association with violence.",
        "Identified prospect needs and developed responses with information on suitable services."
      ],
      "skills": [
        "s-market"
      ]
    },
    {
      "id": "o-ubisoft",
      "type": "Organization",
      "label": "Ubisoft Entertainment India Pvt. Ltd.",
      "short": "Ubisoft India",
      "description": "Ubisoft's Pune studio, mainly testing games for other Ubisoft studios and beginning to take on game design."
    },
    {
      "id": "r-ubisoft",
      "type": "Role",
      "label": "Intern Game Tester",
      "org": "o-ubisoft",
      "via": "e-rubika",
      "start": "2019-12",
      "end": "2020-02",
      "location": "Pune, India",
      "highlights": [
        "Tested the gameplay functionality and integrity of a AAA title and reported bugs in JIRA.",
        "Prepared reports on the testing team's work, tracked player responses to the game on social media, and kept the team updated on company news.",
        "Received a full-time Junior Game Tester offer at the end of the internship."
      ],
      "skills": [
        "s-gameqa",
        "s-jira"
      ]
    },
    {
      "id": "o-hog",
      "type": "Organization",
      "label": "House of Gaming Pvt. Ltd.",
      "short": "House of Gaming",
      "description": "Esports company behind the Indian Gaming League brand."
    },
    {
      "id": "r-hog",
      "type": "Role",
      "label": "Operations Management Intern",
      "short": "Operations Mgmt Intern,\nIndian Gaming League",
      "org": "o-hog",
      "start": "2019-01",
      "end": "2019-07",
      "location": "Mumbai, India",
      "summary": "Worked on the company's esports brand, Indian Gaming League.",
      "highlights": [
        "Set up operations for the company's esports brand, Indian Gaming League.",
        "Took part in decisions on the development of the website and mobile applications together with the development team.",
        "Continuously researched the gaming industry for the latest news and upcoming tournaments and events."
      ],
      "skills": [
        "s-esports",
        "s-requirements"
      ]
    },
    {
      "id": "o-oracle",
      "type": "Organization",
      "label": "Oracle Financial Services Software Ltd.",
      "short": "Oracle FSS",
      "description": "Oracle subsidiary building software for banks and other financial institutions."
    },
    {
      "id": "r-oracle",
      "type": "Role",
      "label": "Project Intern",
      "org": "o-oracle",
      "start": "2017-12",
      "end": "2018-01",
      "location": "Mumbai, India",
      "highlights": [
        "Developed REST web services for model uploading in Oracle Financial Services Analytical Applications (OFSAA) and performed unit testing.",
        "Worked on the development of a Data Quality Framework.",
        "Built a Java web application with Servlets, JSP and JDBC on an Oracle database, then re-implemented its operations as a JSON REST service with JAX-RS (Jersey) and a client to exercise every endpoint."
      ],
      "skills": [
        "s-java",
        "s-rest",
        "s-servlets",
        "s-jdbc",
        "s-oracledb",
        "s-sql",
        "s-unittest",
        "s-dq"
      ]
    },
    {
      "id": "a-ironman",
      "type": "Award",
      "label": "“Iron Man” Award",
      "org": "o-flexmoney",
      "date": "2023-02",
      "location": "Mumbai, India",
      "summary": "Recognized for driving innovation in analytics, introducing new automated insights workflows, and supporting company-wide growth initiatives."
    },
    {
      "id": "sch-stuttgart",
      "type": "School",
      "label": "Universität Stuttgart"
    },
    {
      "id": "e-msc",
      "type": "Education",
      "label": "Master's, Computer Science",
      "short": "M.Sc. Computer Science",
      "school": "sch-stuttgart",
      "start": "2024-04",
      "location": "Stuttgart, Germany",
      "summary": "Focus: knowledge graphs, semantic web, ontology engineering, machine learning.",
      "skills": [
        "s-ontology",
        "s-dl",
        "s-kge",
        "s-rdfs",
        "s-shacl",
        "s-pytorch"
      ]
    },
    {
      "id": "sch-tsec",
      "type": "School",
      "label": "Thadomal Shahani Engineering College",
      "short": "Thadomal Shahani\nEngineering College"
    },
    {
      "id": "e-be",
      "type": "Education",
      "label": "Bachelor's, Computer Engineering",
      "school": "sch-tsec",
      "start": "2015-08",
      "end": "2019-07",
      "skills": [
        "s-agile"
      ]
    },
    {
      "id": "sch-rubika",
      "type": "School",
      "label": "Rubika Supinfogame India",
      "short": "Rubika, Pune"
    },
    {
      "id": "e-rubika",
      "type": "Education",
      "label": "Certificate, Game Testing in Quality Control",
      "short": "Game Testing (QC)\nCertificate",
      "school": "sch-rubika",
      "partner": "o-ubisoft",
      "start": "2019-08",
      "end": "2020-02",
      "location": "Pune, India",
      "summary": "Six-month programme in game testing jointly conducted by Ubisoft Pune and Rubika: four months of coursework at Rubika followed by the Ubisoft internship. Coursework covered industry research, the video-game development life cycle, game art and design concepts, frameworks for testing video games, bug-reporting tools, and project and team management.",
      "skills": [
        "s-gamedesign",
        "s-gameqa"
      ]
    },
    {
      "id": "c-udemy-python",
      "type": "Certification",
      "label": "Complete Python Bootcamp: From Zero to Hero in Python",
      "short": "Python Bootcamp\n(Udemy)",
      "issuer": "Udemy",
      "date": "2020-09",
      "url": "http://ude.my/UC-544d7ee3-b558-46b0-941e-bc03ef3603c8",
      "summary": "Credential ID UC-544d7ee3-b558-46b0-941e-bc03ef3603c8",
      "skills": [
        "s-python"
      ]
    },
    {
      "id": "c-hackerrank-python",
      "type": "Certification",
      "label": "Python (Basic) Certificate",
      "short": "Python (Basic)\n(HackerRank)",
      "issuer": "HackerRank",
      "date": "2020-09",
      "summary": "Credential ID 9394CF9CC5B4",
      "skills": [
        "s-python"
      ]
    },
    {
      "id": "c-ielts",
      "type": "Certification",
      "label": "IELTS Academic, overall band 8.0 (CEFR C1)",
      "short": "IELTS Academic\n8.0 (C1)",
      "issuer": "IELTS",
      "date": "2023-04",
      "summary": "Listening 8.5, Reading 9.0, Writing 8.0, Speaking 7.0."
    },
    {
      "id": "p-thesis",
      "type": "Project",
      "label": "Semantic Concept Learning in EL++ Knowledge Graphs using Box Embeddings",
      "short": "Master's thesis:\nEL++ box embeddings",
      "partOf": "e-msc",
      "status": "Master's thesis, ongoing",
      "start": "2026-03",
      "location": "Stuttgart, Germany",
      "highlights": [
        "Investigating concept learning with description logics and geometric box embeddings, evaluating semantic similarity and concept prediction in knowledge graphs."
      ],
      "skills": [
        "s-dl",
        "s-kge",
        "s-owl",
        "s-git"
      ]
    },
    {
      "id": "p-weft",
      "type": "Project",
      "label": "Weft: designed and published an open ontology for evidence-backed career graphs",
      "short": "Weft ontology",
      "start": "2026-10",
      "url": "https://w3id.org/weft",
      "highlights": [
        "Designed Weft, an OWL vocabulary of 28 terms extending Schema.org that links each skill to the roles, projects, courses and certifications behind it; published it under CC BY 4.0 with documentation in HTML, Turtle, JSON-LD and RDF/XML, a JSON-LD context and an example that uses every term.",
        "Gave every term a permanent w3id.org IRI that resolves by content negotiation, with versioned IRIs for each release (weft/1.0) and a changelog.",
        "Linked 69 skills and 5 languages to Wikidata and ESCO with SKOS exactMatch/closeMatch mappings.",
        "Validated the published graph with SHACL shapes and domain/range checks in a GitHub Actions pipeline that blocks publishing on violations."
      ],
      "skills": [
        "s-ontology",
        "s-owl",
        "s-rdf",
        "s-rdfs",
        "s-shacl",
        "s-turtle",
        "s-semmodel",
        "s-python",
        "s-cicd",
        "s-git",
        "s-docs"
      ]
    },
    {
      "id": "p-loom",
      "type": "Project",
      "label": "Loom: open-source CSV-to-RDF ontology mapping tool",
      "short": "Loom",
      "start": "2026-06",
      "url": "https://github.com/rishirajani/loom",
      "highlights": [
        "Built a locally running TypeScript/React application using N3.js to map spreadsheet columns to RDF vocabularies and generate structured semantic representations.",
        "Implemented mapping suggestions, datatype matching and integrity checks for duplicate records and unmapped columns; integrated CI checks and 41 Vitest regression tests.",
        "Runs entirely in the browser with no server or upload; bundles Schema.org and DCAT ontology subsets, offers tiered mapping suggestions, detects duplicate identifiers and IRI collisions, validates the base IRI and exports Turtle. Released under the MIT licence."
      ],
      "skills": [
        "s-ts",
        "s-react",
        "s-n3",
        "s-rdf",
        "s-turtle",
        "s-semmodel",
        "s-s2t",
        "s-dq",
        "s-cicd",
        "s-git"
      ]
    },
    {
      "id": "p-heat",
      "type": "Project",
      "label": "Urban Heat Risk Knowledge Graph",
      "short": "Urban Heat Risk KG",
      "start": "2026-05",
      "end": "2026-09",
      "url": "https://github.com/adam979/HeatRiskReasoning",
      "highlights": [
        "In a two-person team, built an RDF/OWL knowledge graph of heat risk in Stuttgart-Mitte that links CityGML LoD2 buildings, climate observations, OpenStreetMap vegetation, terrain and satellite land cover through shared zone and building URIs, reusing BOT, GeoSPARQL and SOSA/SSN; it covers 5,801 buildings in about 222,000 triples and is queried with SPARQL.",
        "Reworked the ontology (an assessment-node pattern, the class hierarchy and the namespaces) and restructured the pipeline around it: wrote the composite risk score and the pipeline orchestrator, added OpenStreetMap enrichment, and refactored the CityGML converter, climate ingestion and reasoner.",
        "Replaced hard-coded indicators with measured data: topographic exposure from DGM1 terrain (TPI) instead of fixed per-zone basin depths, and Copernicus CLMS tree canopy and imperviousness instead of a fixed imperviousness of 0.80.",
        "Added a 100 m sub-zone grid of 400 cells that re-resolves four of the six indicators per cell, turning four flat zone scores into a continuous risk gradient.",
        "Validated the ranking against a published benchmark (Theeuwes et al., 2017) and Landsat 8/9 surface temperature, handling scene selection, cloud masking and overpass-time checks (Spearman ρ = 0.61 across 400 grid cells), and tested robustness with a ±25% weight sensitivity analysis."
      ],
      "skills": [
        "s-rdf",
        "s-owl",
        "s-sparql",
        "s-ontology",
        "s-semmodel",
        "s-integration",
        "s-python",
        "s-git"
      ]
    },
    {
      "id": "p-arch",
      "type": "Project",
      "label": "Knowledge Graph Applications in Architecture",
      "short": "KGs in Architecture",
      "start": "2026-04",
      "end": "2026-09",
      "highlights": [
        "Designed Turtle ontologies for crane navigation and urban landscape analysis.",
        "Imported the spider-crane navigation ontology into Neo4j's labeled property graph with neosemantics (438 RDF triples, with registered namespace prefixes so labels stay readable) and explored its classes, zone transitions and mobility modes in Cypher.",
        "Because neosemantics does not execute SWRL rules, represented the rule-based inferences as materialized triples and equivalent Cypher MERGE operations."
      ],
      "skills": [
        "s-turtle",
        "s-ontology",
        "s-rdf",
        "s-neo4j",
        "s-n10s",
        "s-cypher"
      ]
    },
    {
      "id": "p-rossmann",
      "type": "Project",
      "label": "Rossmann Store Sales Prediction",
      "short": "Rossmann Sales\nPrediction",
      "partOf": "e-be",
      "status": "Bachelor's final-year project, team of three",
      "start": "2018-10",
      "end": "2019-04",
      "summary": "Final-year Computer Engineering project comparing machine learning models for retail sales forecasting, plus a web application that uses them to predict daily or weekly sales for any of the 1,115 stores of the Dirk Rossmann GmbH chain.",
      "highlights": [
        "Performed a comparative analysis of Linear Regression, K-Nearest Neighbors and XGBoost regression on the Kaggle Rossmann Store Sales dataset to determine the merits and drawbacks of each model.",
        "Cleaned the data and selected 11 features using correlation heatmaps, Variance Inflation Factors and chi-square tests, discarding highly collinear features such as Promo2.",
        "Evaluated the models on an 80/20 split with RMSE and adjusted R²: XGBoost reached an RMSE of 457 and adjusted R² of 97.8%, against 1,015 and 89.3% for KNN and 1,545 and 75.2% for Linear Regression.",
        "Developed a Django web application with employee login that loads the serialized models and predicts a store's sales for a day or a chosen week with all three models, comparing results with promotions on and off.",
        "In hindsight, these scores overstate real forecasting accuracy: same-day customer counts, unknown at prediction time, were used as a feature, and the test set was a random rather than time-based split. A leakage-free evaluation would drop Customers, hold out the final weeks, and tune on a separate validation set."
      ],
      "skills": [
        "s-python",
        "s-sklearn",
        "s-xgboost",
        "s-regression",
        "s-featsel",
        "s-django",
        "s-sqlite",
        "s-web"
      ]
    },
    {
      "id": "g-gov",
      "type": "SkillGroup",
      "label": "Business semantics & data governance",
      "short": "Data governance"
    },
    {
      "id": "s-kpi",
      "type": "Skill",
      "label": "Business-term & KPI definitions",
      "group": "g-gov",
      "closeMatch": [
        "wd:Q860554",
        "wd:Q61314299",
        "esco:8dcbcabe-09f7-4d11-940d-125af57bbc40"
      ]
    },
    {
      "id": "s-metricstd",
      "type": "Skill",
      "label": "Metric standardization",
      "group": "g-gov",
      "closeMatch": [
        "wd:Q860554"
      ]
    },
    {
      "id": "s-s2t",
      "type": "Skill",
      "label": "Source-to-target mapping",
      "group": "g-gov",
      "closeMatch": [
        "wd:Q2330408"
      ]
    },
    {
      "id": "s-dq",
      "type": "Skill",
      "label": "Data-quality rules",
      "group": "g-gov",
      "closeMatch": [
        "wd:Q1757694",
        "esco:54c9c155-9293-4329-8ed2-2e76e8b519d4"
      ]
    },
    {
      "id": "s-mdm",
      "type": "Skill",
      "label": "Master-data validation",
      "group": "g-gov",
      "closeMatch": [
        "wd:Q190349"
      ]
    },
    {
      "id": "s-reconcile",
      "type": "Skill",
      "label": "Data reconciliation",
      "group": "g-gov",
      "exactMatch": [
        "wd:Q48719515"
      ]
    },
    {
      "id": "s-docs",
      "type": "Skill",
      "label": "Technical documentation",
      "group": "g-gov",
      "exactMatch": [
        "wd:Q1413406",
        "esco:04dfd9fb-e0cf-40f6-96c6-9d2280c4347e"
      ]
    },
    {
      "id": "s-privacy",
      "type": "Skill",
      "label": "Data privacy (PII handling)",
      "group": "g-gov",
      "exactMatch": [
        "esco:5d5ba629-0b4c-424f-8803-000c3736f3f7"
      ],
      "closeMatch": [
        "wd:Q1076693"
      ]
    },
    {
      "id": "g-kr",
      "type": "SkillGroup",
      "label": "Knowledge representation & ontologies",
      "short": "Knowledge representation"
    },
    {
      "id": "s-rdf",
      "type": "Skill",
      "label": "RDF",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q54872"
      ]
    },
    {
      "id": "s-rdfs",
      "type": "Skill",
      "label": "RDFS",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q1751819"
      ]
    },
    {
      "id": "s-owl",
      "type": "Skill",
      "label": "OWL",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q826165"
      ]
    },
    {
      "id": "s-sparql",
      "type": "Skill",
      "label": "SPARQL",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q54871",
        "esco:5da8018b-ae85-4cde-ad93-0394369018f3"
      ],
      "closeMatch": [
        "esco:99207709-d076-4cce-ba38-e90d3bb28806"
      ]
    },
    {
      "id": "s-shacl",
      "type": "Skill",
      "label": "SHACL",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q29377821"
      ]
    },
    {
      "id": "s-turtle",
      "type": "Skill",
      "label": "Turtle",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q114409"
      ]
    },
    {
      "id": "s-ontology",
      "type": "Skill",
      "label": "Ontology engineering",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q1027508"
      ]
    },
    {
      "id": "s-dl",
      "type": "Skill",
      "label": "Description logics",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q387196"
      ]
    },
    {
      "id": "s-semmodel",
      "type": "Skill",
      "label": "Semantic modeling",
      "group": "g-kr",
      "closeMatch": [
        "wd:Q7449052",
        "esco:fbafa41f-cd05-4109-a649-8b44d306d779"
      ]
    },
    {
      "id": "s-neo4j",
      "type": "Skill",
      "label": "Neo4j",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q1628290"
      ]
    },
    {
      "id": "s-cypher",
      "type": "Skill",
      "label": "Cypher",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q16834355"
      ],
      "closeMatch": [
        "esco:75f839c2-fd9a-4ad3-8921-6e734608568d"
      ]
    },
    {
      "id": "s-n10s",
      "type": "Skill",
      "label": "neosemantics",
      "group": "g-kr",
      "exactMatch": [
        "wd:Q140676801"
      ]
    },
    {
      "id": "g-de",
      "type": "SkillGroup",
      "label": "Enterprise data engineering",
      "short": "Data engineering"
    },
    {
      "id": "s-python",
      "type": "Skill",
      "label": "Python",
      "group": "g-de",
      "exactMatch": [
        "wd:Q28865",
        "esco:ccd0a1d9-afda-43d9-b901-96344886e14d"
      ]
    },
    {
      "id": "s-sql",
      "type": "Skill",
      "label": "SQL",
      "group": "g-de",
      "exactMatch": [
        "wd:Q47607",
        "esco:598de5b0-5b58-4ea7-8058-a4bc4d18c742"
      ]
    },
    {
      "id": "s-etl",
      "type": "Skill",
      "label": "ETL / ELT",
      "group": "g-de",
      "exactMatch": [
        "wd:Q1276130"
      ],
      "closeMatch": [
        "esco:9d0d89be-bffa-4393-b6f6-8d05bea49051"
      ]
    },
    {
      "id": "s-integration",
      "type": "Skill",
      "label": "Data integration",
      "group": "g-de",
      "exactMatch": [
        "wd:Q386824"
      ]
    },
    {
      "id": "s-postgres",
      "type": "Skill",
      "label": "PostgreSQL",
      "group": "g-de",
      "exactMatch": [
        "wd:Q192490",
        "esco:a8d07b5a-c1a1-42c6-9d53-db9c7a2ca996"
      ]
    },
    {
      "id": "s-sap",
      "type": "Skill",
      "label": "SAP HANA integration",
      "group": "g-de",
      "closeMatch": [
        "wd:Q951374"
      ]
    },
    {
      "id": "s-redshift",
      "type": "Skill",
      "label": "Redshift",
      "group": "g-de",
      "exactMatch": [
        "wd:Q17012109"
      ]
    },
    {
      "id": "s-docker",
      "type": "Skill",
      "label": "Docker",
      "group": "g-de",
      "exactMatch": [
        "wd:Q15206305"
      ]
    },
    {
      "id": "s-sqlite",
      "type": "Skill",
      "label": "SQLite",
      "group": "g-de",
      "exactMatch": [
        "wd:Q319417"
      ]
    },
    {
      "id": "s-athena",
      "type": "Skill",
      "label": "AWS Athena",
      "group": "g-de",
      "exactMatch": [
        "wd:Q65203360"
      ]
    },
    {
      "id": "s-jdbc",
      "type": "Skill",
      "label": "JDBC",
      "group": "g-de",
      "exactMatch": [
        "wd:Q722772"
      ]
    },
    {
      "id": "s-oracledb",
      "type": "Skill",
      "label": "Oracle Database",
      "group": "g-de",
      "exactMatch": [
        "wd:Q185524",
        "esco:de9f85ba-e77f-48fd-8c66-f5ebaf32d655"
      ]
    },
    {
      "id": "s-mssql",
      "type": "Skill",
      "label": "Microsoft SQL Server",
      "group": "g-de",
      "exactMatch": [
        "wd:Q215819",
        "esco:c062bab3-3ea0-4291-9220-a2d8fef4bead"
      ]
    },
    {
      "id": "s-sqlalchemy",
      "type": "Skill",
      "label": "SQLAlchemy",
      "group": "g-de",
      "exactMatch": [
        "wd:Q1092514"
      ]
    },
    {
      "id": "s-pandas",
      "type": "Skill",
      "label": "pandas",
      "group": "g-de",
      "exactMatch": [
        "wd:Q15967387"
      ]
    },
    {
      "id": "s-cron",
      "type": "Skill",
      "label": "Job scheduling (cron)",
      "group": "g-de",
      "exactMatch": [
        "wd:Q300864"
      ]
    },
    {
      "id": "g-an",
      "type": "SkillGroup",
      "label": "Analytics & platforms",
      "short": "Analytics"
    },
    {
      "id": "s-superset",
      "type": "Skill",
      "label": "Apache Superset",
      "group": "g-an",
      "exactMatch": [
        "wd:Q68705831"
      ]
    },
    {
      "id": "s-clevertap",
      "type": "Skill",
      "label": "CleverTap",
      "group": "g-an",
      "closeMatch": [
        "wd:Q48966378"
      ]
    },
    {
      "id": "s-funnel",
      "type": "Skill",
      "label": "Funnel analytics",
      "group": "g-an",
      "exactMatch": [
        "wd:Q18356622"
      ],
      "closeMatch": [
        "wd:Q5166474"
      ]
    },
    {
      "id": "s-attribution",
      "type": "Skill",
      "label": "Campaign attribution",
      "group": "g-an"
    },
    {
      "id": "s-kpifw",
      "type": "Skill",
      "label": "KPI frameworks",
      "group": "g-an",
      "closeMatch": [
        "wd:Q860554",
        "wd:Q1771949",
        "esco:8dcbcabe-09f7-4d11-940d-125af57bbc40"
      ]
    },
    {
      "id": "s-alerting",
      "type": "Skill",
      "label": "Monitoring & alerting (OpsGenie)",
      "short": "Monitoring & alerting",
      "group": "g-an"
    },
    {
      "id": "s-segment",
      "type": "Skill",
      "label": "Customer segmentation",
      "group": "g-an",
      "exactMatch": [
        "esco:136e0cab-0b19-48f7-9086-745d615f416b"
      ],
      "closeMatch": [
        "wd:Q363057"
      ]
    },
    {
      "id": "s-survey",
      "type": "Skill",
      "label": "Survey analysis & user personas",
      "group": "g-an",
      "closeMatch": [
        "wd:Q814232",
        "esco:6b30644d-bdc5-4bca-b1af-edbf5c6b15ee"
      ]
    },
    {
      "id": "s-market",
      "type": "Skill",
      "label": "Market research",
      "group": "g-an",
      "exactMatch": [
        "wd:Q913709",
        "esco:8770350e-746f-4adb-9556-18ca68104be6"
      ]
    },
    {
      "id": "g-sw",
      "type": "SkillGroup",
      "label": "Software engineering & AI",
      "short": "Software & AI"
    },
    {
      "id": "s-ts",
      "type": "Skill",
      "label": "TypeScript",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q978185",
        "esco:867137fb-ff1b-4ca3-99f3-cb6969aa2c68"
      ]
    },
    {
      "id": "s-react",
      "type": "Skill",
      "label": "React",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q19399674"
      ]
    },
    {
      "id": "s-n3",
      "type": "Skill",
      "label": "N3.js",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q140704882"
      ]
    },
    {
      "id": "s-java",
      "type": "Skill",
      "label": "Java",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q251",
        "esco:19a8293b-8e95-4de3-983f-77484079c389"
      ]
    },
    {
      "id": "s-git",
      "type": "Skill",
      "label": "Git",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q186055"
      ],
      "closeMatch": [
        "esco:9d2e926f-53d9-41f5-98f3-19dfaa687f3f"
      ]
    },
    {
      "id": "s-cicd",
      "type": "Skill",
      "label": "CI / CD",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q28136854"
      ],
      "closeMatch": [
        "wd:Q965769",
        "wd:Q2507377"
      ]
    },
    {
      "id": "s-pytorch",
      "type": "Skill",
      "label": "PyTorch",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q47509047"
      ]
    },
    {
      "id": "s-sklearn",
      "type": "Skill",
      "label": "scikit-learn",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q1026367"
      ]
    },
    {
      "id": "s-kge",
      "type": "Skill",
      "label": "Knowledge graph embeddings",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q33003557"
      ]
    },
    {
      "id": "s-xgboost",
      "type": "Skill",
      "label": "XGBoost",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q23793561"
      ]
    },
    {
      "id": "s-regression",
      "type": "Skill",
      "label": "Regression modelling",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q208042"
      ]
    },
    {
      "id": "s-featsel",
      "type": "Skill",
      "label": "Feature selection",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q446488"
      ]
    },
    {
      "id": "s-django",
      "type": "Skill",
      "label": "Django",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q842014"
      ]
    },
    {
      "id": "s-web",
      "type": "Skill",
      "label": "HTML / CSS / JavaScript",
      "group": "g-sw",
      "closeMatch": [
        "wd:Q8811",
        "wd:Q46441",
        "wd:Q2005",
        "esco:3cd569a2-4f88-4c1e-9995-8dce8c5e51a7",
        "esco:e5d1f825-60ed-4bdd-872a-e748c387f777",
        "esco:0af062de-eb43-41e9-9b96-249e2cd22d26"
      ]
    },
    {
      "id": "s-rest",
      "type": "Skill",
      "label": "REST APIs",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q749568"
      ]
    },
    {
      "id": "s-servlets",
      "type": "Skill",
      "label": "Java Servlets & JSP",
      "group": "g-sw",
      "closeMatch": [
        "wd:Q375673",
        "wd:Q183169"
      ]
    },
    {
      "id": "s-unittest",
      "type": "Skill",
      "label": "Unit testing",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q907375",
        "esco:7961413f-61d0-4722-9cd9-20a050a29899"
      ]
    },
    {
      "id": "s-jira",
      "type": "Skill",
      "label": "JIRA",
      "group": "g-sw",
      "exactMatch": [
        "wd:Q1359246"
      ]
    },
    {
      "id": "g-games",
      "type": "SkillGroup",
      "label": "Games & esports"
    },
    {
      "id": "s-gameqa",
      "type": "Skill",
      "label": "Game QA testing",
      "group": "g-games",
      "exactMatch": [
        "wd:Q1093030"
      ]
    },
    {
      "id": "s-gamedesign",
      "type": "Skill",
      "label": "Game design fundamentals",
      "group": "g-games",
      "exactMatch": [
        "wd:Q858057"
      ]
    },
    {
      "id": "s-esports",
      "type": "Skill",
      "label": "Esports operations",
      "group": "g-games",
      "closeMatch": [
        "wd:Q300920"
      ]
    },
    {
      "id": "g-collab",
      "type": "SkillGroup",
      "label": "Collaboration"
    },
    {
      "id": "s-stakeholders",
      "type": "Skill",
      "label": "Cross-functional stakeholder alignment",
      "short": "Stakeholder alignment",
      "group": "g-collab",
      "closeMatch": [
        "wd:Q59751"
      ]
    },
    {
      "id": "s-requirements",
      "type": "Skill",
      "label": "Business requirements analysis",
      "short": "Requirements analysis",
      "group": "g-collab",
      "exactMatch": [
        "esco:b04f377b-ee80-4b38-aca1-19d266a23b17"
      ],
      "closeMatch": [
        "wd:Q187147",
        "wd:Q5001932"
      ]
    },
    {
      "id": "s-enablement",
      "type": "Skill",
      "label": "User enablement",
      "group": "g-collab"
    },
    {
      "id": "s-agile",
      "type": "Skill",
      "label": "Agile / Scrum",
      "group": "g-collab",
      "closeMatch": [
        "wd:Q30232",
        "wd:Q460387",
        "esco:dba46f87-0831-49cd-a1c7-340a653c0221"
      ]
    },
    {
      "id": "l-en",
      "type": "Language",
      "label": "English",
      "level": "Fluent",
      "exactMatch": [
        "wd:Q1860"
      ]
    },
    {
      "id": "l-de",
      "type": "Language",
      "label": "German",
      "level": "B1",
      "exactMatch": [
        "wd:Q188"
      ]
    },
    {
      "id": "l-hi",
      "type": "Language",
      "label": "Hindi",
      "level": "Native",
      "exactMatch": [
        "wd:Q1568"
      ]
    },
    {
      "id": "l-mr",
      "type": "Language",
      "label": "Marathi",
      "level": "Basic",
      "exactMatch": [
        "wd:Q1571"
      ]
    },
    {
      "id": "l-sd",
      "type": "Language",
      "label": "Sindhi",
      "level": "Basic",
      "exactMatch": [
        "wd:Q33997"
      ]
    }
  ]
};
