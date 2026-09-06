// Shared building blocks for the public module introduction pages
// (/xceed-learning and /ileed). Both are marketing-side landing pages reached
// from the badges at the top of the home hero, so they follow the home page's
// dark Jakarta styling rather than either module's own in-app chrome.
//
// Accent classes are kept as complete literal strings in ACCENTS below:
// Tailwind scans source text, so a composed name like `tw-text-${accent}-300`
// would never make it into the build.

import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

const ACCENTS = {
  cyan: {
    text: 'tw-text-cyan-300',
    solid: 'tw-bg-cyan-600 hover:tw-bg-cyan-700 focus:tw-ring-cyan-300',
    soft: 'tw-bg-cyan-500/10 tw-border-cyan-500/30',
    dot: 'tw-bg-cyan-400',
    rule: 'tw-border-cyan-400',
    glow: 'tw-from-cyan-500/25',
    hoverBorder: 'hover:tw-border-cyan-500/50',
  },
  emerald: {
    text: 'tw-text-emerald-300',
    solid: 'tw-bg-emerald-600 hover:tw-bg-emerald-700 focus:tw-ring-emerald-300',
    soft: 'tw-bg-emerald-500/10 tw-border-emerald-500/30',
    dot: 'tw-bg-emerald-400',
    rule: 'tw-border-emerald-400',
    glow: 'tw-from-emerald-500/25',
    hoverBorder: 'hover:tw-border-emerald-500/50',
  },
};

const accentOf = (name) => ACCENTS[name] ?? ACCENTS.cyan;

/** The "Newly launched" pill, reused by the hero and by the home-page badges. */
export function NewlyLaunchedTag({ className = '' }) {
  return (
    <span
      className={`tw-text-xs tw-bg-teal-500 tw-font-bold tw-uppercase tw-rounded-full tw-text-white tw-px-4 tw-py-1.5 ${className}`}
    >
      Newly launched
    </span>
  );
}

export function IntroHero({
  accent = 'cyan',
  wordmark,
  title,
  tagline,
  description,
  primaryCta,
  secondaryCta,
}) {
  const a = accentOf(accent);
  return (
    <section className="tw-relative tw-overflow-hidden">
      <div
        className={`tw-pointer-events-none tw-absolute tw-inset-x-0 tw--top-40 tw-h-96 tw-bg-gradient-to-b ${a.glow} tw-to-transparent tw-blur-3xl`}
        aria-hidden="true"
      />
      <div className="tw-relative tw-max-w-screen-xl tw-mx-auto tw-px-4 lg:tw-px-12 tw-pt-12 lg:tw-pt-20 tw-pb-10 tw-text-center">
        <div className="tw-mb-7 tw-inline-flex tw-items-center tw-gap-3 tw-rounded-full tw-bg-gray-800 tw-py-1 tw-pl-1 tw-pr-4">
          <NewlyLaunchedTag />
          <span className="tw-text-sm tw-font-medium tw-text-white">
            Built by XCEED at NIT Jalandhar
          </span>
        </div>

        {wordmark ? <div className="tw-mb-5">{wordmark}</div> : null}

        <h1 className="tw-mb-4 tw-text-4xl tw-font-extrabold tw-tracking-tight tw-leading-none tw-text-white md:tw-text-5xl lg:tw-text-6xl">
          {title}
        </h1>
        <p className={`tw-mb-6 tw-text-xl lg:tw-text-2xl tw-font-semibold ${a.text}`}>
          {tagline}
        </p>
        <p className="tw-mb-8 tw-mx-auto tw-max-w-3xl tw-text-lg tw-font-normal tw-text-gray-300">
          {description}
        </p>

        <div className="tw-flex tw-flex-col tw-gap-4 sm:tw-flex-row sm:tw-justify-center">
          {primaryCta ? (
            <Link
              to={primaryCta.to}
              target={primaryCta.external ? '_blank' : undefined}
              className={`tw-inline-flex tw-justify-center tw-items-center tw-py-3 tw-px-5 tw-text-base tw-font-medium tw-text-white tw-rounded-lg focus:tw-ring-4 ${a.solid}`}
            >
              {primaryCta.label}
              <ChevronRightIcon strokeWidth={2.5} className="tw-ml-2 tw-size-4" />
            </Link>
          ) : null}
          {secondaryCta ? (
            <Link
              to={secondaryCta.to}
              target={secondaryCta.external ? '_blank' : undefined}
              className="tw-inline-flex tw-justify-center tw-items-center tw-py-3 tw-px-5 tw-text-base tw-font-medium tw-text-white tw-rounded-lg tw-border tw-border-gray-700 hover:tw-bg-gray-800 focus:tw-ring-4 focus:tw-ring-gray-800"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function IntroSection({ id, accent = 'cyan', kicker, title, description, children }) {
  const a = accentOf(accent);
  return (
    <section
      id={id}
      className="tw-max-w-screen-xl tw-mx-auto tw-px-4 lg:tw-px-12 tw-py-12 lg:tw-py-16"
    >
      {kicker ? (
        <p className={`tw-mb-2 tw-text-sm tw-font-bold tw-uppercase tw-tracking-widest ${a.text}`}>
          {kicker}
        </p>
      ) : null}
      <h2
        className={`tw-text-2xl md:tw-text-3xl tw-font-bold tw-text-white tw-border-l-4 ${a.rule} tw-pl-4`}
      >
        {title}
      </h2>
      {description ? (
        <p className="tw-mt-4 tw-max-w-3xl tw-text-gray-400 tw-leading-relaxed">{description}</p>
      ) : null}
      <div className="tw-mt-8">{children}</div>
    </section>
  );
}

export function FeatureGrid({ accent = 'cyan', features }) {
  const a = accentOf(accent);
  return (
    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-5">
      {features.map((f) => (
        <div
          key={f.title}
          className={`tw-rounded-xl tw-border tw-border-gray-700 tw-bg-gray-800/60 tw-p-5 tw-transition-colors ${a.hoverBorder}`}
        >
          <div
            className={`tw-mb-3 tw-inline-flex tw-size-10 tw-items-center tw-justify-center tw-rounded-lg tw-border tw-text-lg ${a.soft}`}
          >
            <span aria-hidden="true">{f.icon}</span>
          </div>
          <h3 className="tw-text-base tw-font-semibold tw-text-white">{f.title}</h3>
          <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-gray-400">{f.desc}</p>
        </div>
      ))}
    </div>
  );
}

export function StepFlow({ accent = 'cyan', steps }) {
  const a = accentOf(accent);
  return (
    <ol className="tw-list-none tw-p-0 tw-m-0">
      {steps.map((s, i) => (
        <li key={s.title} className="tw-flex tw-gap-4">
          <div className="tw-flex tw-flex-col tw-items-center">
            <span
              className={`tw-flex tw-size-8 tw-flex-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-text-sm tw-font-bold tw-text-gray-900 ${a.dot}`}
            >
              {i + 1}
            </span>
            {i < steps.length - 1 ? (
              <span className="tw-my-1 tw-w-px tw-flex-1 tw-bg-gray-700" aria-hidden="true" />
            ) : null}
          </div>
          <div className="tw-pb-6">
            <h3 className="tw-text-base tw-font-semibold tw-text-white">{s.title}</h3>
            <p className="tw-mt-1 tw-text-sm tw-leading-relaxed tw-text-gray-400">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StatRow({ accent = 'cyan', stats }) {
  const a = accentOf(accent);
  return (
    <div className="tw-grid tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="tw-rounded-xl tw-border tw-border-gray-700 tw-bg-gray-800/60 tw-p-5"
        >
          <div className={`tw-text-2xl tw-font-extrabold ${a.text}`}>{s.value}</div>
          <div className="tw-mt-1 tw-text-sm tw-text-gray-400">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function IntroCTA({ accent = 'cyan', title, description, primaryCta, secondaryCta }) {
  const a = accentOf(accent);
  return (
    <section className="tw-max-w-screen-xl tw-mx-auto tw-px-4 lg:tw-px-12 tw-pb-16">
      <div className={`tw-rounded-2xl tw-border tw-p-8 lg:tw-p-12 tw-text-center ${a.soft}`}>
        <h2 className="tw-text-2xl md:tw-text-3xl tw-font-bold tw-text-white">{title}</h2>
        <p className="tw-mt-3 tw-mx-auto tw-max-w-2xl tw-text-gray-300">{description}</p>
        <div className="tw-mt-7 tw-flex tw-flex-col tw-gap-4 sm:tw-flex-row sm:tw-justify-center">
          {primaryCta ? (
            <Link
              to={primaryCta.to}
              target={primaryCta.external ? '_blank' : undefined}
              className={`tw-inline-flex tw-justify-center tw-items-center tw-py-3 tw-px-5 tw-text-base tw-font-medium tw-text-white tw-rounded-lg focus:tw-ring-4 ${a.solid}`}
            >
              {primaryCta.label}
            </Link>
          ) : null}
          {secondaryCta ? (
            <Link
              to={secondaryCta.to}
              target={secondaryCta.external ? '_blank' : undefined}
              className="tw-inline-flex tw-justify-center tw-items-center tw-py-3 tw-px-5 tw-text-base tw-font-medium tw-text-white tw-rounded-lg tw-border tw-border-gray-700 hover:tw-bg-gray-800"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
