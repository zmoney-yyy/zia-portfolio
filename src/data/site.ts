// Page copy for Home. Single source of truth: the page renders from this file and the
// chat system prompt is built from it (plus the six project cards and content/chat-facts.md).
// Only public, confirmed claims belong here. No proprietary figures.

export const site = {
  name: 'Zia Hasheem',
  title: 'Zia Hasheem | Product Marketing Manager',
  description:
    'Product marketing manager. I make products easy to understand and easy to adopt: launches, GTM strategy and product-led growth.',
  url: 'https://zia.mba',
  linkedin: 'https://www.linkedin.com/in/ziahasheem/',
  repo: 'https://github.com/zmoney-yyy/zia-portfolio',
  ogAlt: 'Zia Hasheem, product marketing. I make products easy to understand and easy to adopt.',
};

export const hero = {
  eyebrow: 'Product launches | GTM strategy | Product-led growth',
  headlineBefore: 'I make products easy to understand and easy to ',
  headlineEmphasis: 'adopt',
  subhead:
    'Senior product marketing manager with eight years at Salesforce, working the full product lifecycle. I work out how a product should be positioned, launch it, and stay on it with Product and Sales through onboarding and adoption, until customers can see why it matters to them.',
  badge: 'Open to product marketing roles',
};

// `count` drives the scroll count-up; `value` is the final text (also the no-JS text).
export const proof = [
  { value: '10K+', count: 10, suffix: 'K+', label: 'new customers across Starter and Pro Suite' },
  { value: '3 weeks', count: 3, suffix: ' weeks', label: 'to hit the Foundations month-one activation goal' },
  { value: '23 days', count: 23, suffix: ' days', label: 'sooner to a first agent, Agentforce emails vs. a control group' },
];

export const workIntro = {
  eyebrow: 'Selected work',
  heading: "Six projects, one thread: helping customers see what's in it for them.",
};

export const howIWork = {
  eyebrow: 'How I work',
  heading: 'Start with the customer. Keep it simple. Stay till the first win.',
  principles: [
    {
      title: 'Lead with customer value',
      body: "Customers don't buy features, they buy what's in it for them. I find that first, then craft the message, and build the launch assets.",
    },
    {
      title: 'Make the complex simple',
      body: 'I turn a complicated product into one idea a customer gets at a glance: a demo, a one-pager, a single sentence.',
    },
    {
      title: 'Stay with it after launch',
      body: 'Launch day is the start. I stay on it through onboarding and adoption until customers get their first win.',
    },
  ],
};

export const about = {
  eyebrow: 'About',
  heading: 'Bay Area product marketer, serial home chef.',
  body: "I enjoy seeing things from the perspective of the customer. If it doesn't make sense for the customer, we're doing something wrong. Outside of work I am a father to two amazing boys. I enjoy cooking, riding my motorcycle and having a good time with my family.",
  photoAlt: 'Zia Hasheem smiling, wearing a plum blazer and white shirt, outdoors',
};

export const ask = {
  eyebrow: 'Ask my portfolio',
  heading: 'Skip the skim. Ask a question.',
  body: "An AI assistant that answers only from the work on this site, and says so when it doesn't know. Built with Claude.",
  label: "AI assistant, answering from Zia's portfolio",
  placeholder: 'Ask about a project, a result, or how I work',
  suggestions: [
    'What did Zia do on the Foundations launch?',
    'How did Zia get customers started with Agentforce?',
    'How did the Starter and Pro Suite onboarding journey work?',
  ],
};

export const footer = {
  heading: "Hiring for product marketing? Let's talk.",
};
