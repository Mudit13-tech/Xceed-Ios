import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useState, useEffect } from 'react'
// import { ChevronRightIcon } from '@chakra-ui/icons'
import StarryBackgroundAnimation from './StarryBackgroundAnimation.jsx';
import './heroBadges.css';

/**
 * The pills under the hero: a tag, a name, and somewhere to go.
 *
 * `tagBg` is a whole class name rather than a colour fragment on purpose —
 * Tailwind scans this file as text, so a composed `tw-bg-${colour}-500` would
 * never reach the build.
 */
function HeroBadge({ to, tag, tagBg, label, external }) {
  return (
    <Link
      to={to}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="tw-inline-flex tw-flex-shrink-0 tw-items-center tw-whitespace-nowrap tw-py-1 tw-px-1 tw-pr-4 tw-text-sm tw-text-gray-700 tw-bg-gray-100 tw-rounded-full dark:tw-bg-gray-800 dark:tw-text-white hover:tw-bg-gray-200 dark:hover:tw-bg-gray-700"
    >
      <span
        className={`tw-text-xs ${tagBg} tw-font-bold tw-uppercase tw-rounded-full tw-text-white tw-px-4 tw-py-1.5 tw-mr-3`}
      >
        {tag}
      </span>
      <span className="tw-text-sm tw-font-medium">{label}</span>
      <ChevronRightIcon strokeWidth={2.5} className="tw-size-4 tw-text-white" />
    </Link>
  );
}

/** The two newest modules — given their own line above the rail. */
const NEW_BADGES = [
  {
    to: '/xceed-learning',
    tag: 'Newly launched',
    tagBg: 'tw-bg-teal-500',
    label: 'XCEED Learning',
  },
  {
    to: '/ileed',
    tag: 'Newly launched',
    tagBg: 'tw-bg-teal-500',
    label: 'iLEED — Attendance',
  },
];

/** Newest first; the rail scrolls, so the list can keep growing. */
const RAIL_BADGES = [
  { to: 'https://glogift2026.com/', tag: 'Sold!', tagBg: 'tw-bg-orange-500', label: 'GLOGIFT-2026', external: true },
  { to: 'https://cipher2026.com/', tag: 'Sold!', tagBg: 'tw-bg-yellow-500', label: 'CIPHER-2026', external: true },
  { to: 'https://eaicnitj.com/', tag: 'Sold!', tagBg: 'tw-bg-green-500', label: 'EAIC-2026', external: true },
  { to: 'https://vistanitj.com/', tag: 'Sold!', tagBg: 'tw-bg-gray-500', label: 'VISTA-2026', external: true },
  { to: 'https://igc2025nitj.com/', tag: 'Sold!', tagBg: 'tw-bg-pink-500', label: 'IGC-2025', external: true },
  { to: 'https://amsdt2025.com/', tag: 'Sold!', tagBg: 'tw-bg-blue-500', label: 'AMSDT-2025', external: true },
  { to: 'https://eaic2025.netlify.app/', tag: 'Sold!', tagBg: 'tw-bg-violet-400', label: 'EAIC-2025', external: true },
  { to: 'https://chemcon2024.com/', tag: 'Sold!', tagBg: 'tw-bg-orange-500', label: 'Chemcon-2024', external: true },
  { to: '/timetable', tag: 'Module', tagBg: 'tw-bg-violet-600', label: 'Timetable' },
];
function AnimatedBadge({ newBg, soldBg }) {
  const words = ['NEW', 'SOLD!']
  const [wordIndex, setWordIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const typingSpeed = 150
  const deletingSpeed = 100
  const pauseDuration = 2000

  useEffect(() => {
    let timer
    const current = words[wordIndex]
    if (!isDeleting) {
      if (displayedText.length < current.length) {
        timer = setTimeout(
          () => setDisplayedText(current.slice(0, displayedText.length + 1)),
          typingSpeed
        )
      } else {
        timer = setTimeout(() => setIsDeleting(true), pauseDuration)
      }
    } else {
      if (displayedText.length > 0) {
        timer = setTimeout(
          () => setDisplayedText(current.slice(0, displayedText.length - 1)),
          deletingSpeed
        )
      } else {
        setIsDeleting(false)
        setWordIndex((w) => (w + 1) % words.length)
      }
    }
    return () => clearTimeout(timer)
  }, [displayedText, isDeleting, wordIndex])

  const bgClass =
    displayedText === 'SOLD!' ? `tw-bg-${soldBg}` : `tw-bg-${newBg}`

  return (
    <span
      className={`
        tw-text-xs tw-font-sans tw-font-bold tw-uppercase tw-text-white
        tw-px-4 tw-py-1.5 tw-rounded-full tw-mr-3
        ${bgClass}
        transition-all duration-150 ease-out
      `}
    >  
      {displayedText}
    </span>
  )
}

const Hero = () => {

  
  return (
    <>
    <StarryBackgroundAnimation/>
    <section id="home" >
      <div className="tw-py-8 tw-px-4 tw-mx-auto tw-max-w-screen-xl tw-text-center lg:tw-py-14 lg:tw-px-12">
        {/* The two newest modules, on a line of their own above the rail so
            they are not lost among the conference links. Each goes to its
            public introduction page rather than straight into the module — the
            people these are aimed at usually do not have an account yet. */}
        <div className="tw-mb-10 tw-flex tw-flex-wrap tw-justify-center tw-gap-3">
          {NEW_BADGES.map((badge) => (
            <HeroBadge key={badge.to} {...badge} />
          ))}
        </div>

        {/* Everything else stays on one line and scrolls sideways. There are
            more of these every year, and wrapping them pushed the heading
            further down the page with each one added. */}
        <nav
          aria-label="XCEED sites and modules"
          className="hero-badge-rail tw-mb-7 tw-flex tw-gap-3 tw-overflow-x-auto tw-py-1"
        >
          {RAIL_BADGES.map((badge) => (
            <HeroBadge key={badge.to} {...badge} />
          ))}
        </nav>
        {/* <Link
          to="/nirf"
          className="tw-inline-flex tw-justify-between tw-items-center tw-py-1 tw-px-1 tw-pr-4 tw-mb-7 tw-text-sm tw-text-gray-700 tw-bg-gray-100 tw-rounded-full dark:tw-bg-gray-800 dark:tw-text-white hover:tw-bg-gray-200 dark:hover:tw-bg-gray-700"
          role="alert"
        >
          <span className="tw-text-xs tw-bg-red-600 tw-font-bold tw-uppercase tw-rounded-full tw-text-white tw-px-4 tw-py-1.5 tw-mr-3">
            Module
          </span>{" "}
          <span className="tw-text-sm tw-font-medium">NIRF Search</span>
          <ChevronRightIcon
            strokeWidth={2.5}
            className="tw-size-4 tw-text-white"
          />
        </Link> */}
        <h1 className="tw-mb-5 tw-text-4xl tw-font-extrabold tw-tracking-tight tw-leading-none tw-text-gray-900 md:tw-text-5xl lg:tw-text-6xl dark:tw-text-white">
          Welcome to XCEED!
        </h1>
        <h3 className="tw-mb-5 tw-text-4xl tw-font-extrabold tw-tracking-tight tw-leading-none text-cyan-600 md:tw-text-3xl lg:tw-text-4xl dark:tw-text-cyan-300">
          eXplore, Code, Enrich, Evolve &amp; Develop
        </h3>
        <p className="tw-mb-8 tw-text-lg tw-font-normal tw-text-white lg:tw-text-xl sm:tw-px-16 xl:tw-px-48 dark:tw-text-white">
          Here at XCEED-NITJ we are not just a developer community; we are a hub of innovation,
          collaboration, and excellence. From developing official institute
          projects to pioneering initiatives that redefine the digital
          landscape of NITJ, XCEED stands as a testament to the prowess of our NITJ student
          community.
        </p>
        <div className="tw-flex tw-flex-col tw-mb-8 lg:tw-mb-16 tw-space-y-4 sm:tw-flex-row sm:tw-justify-center sm:tw-space-y-0 sm:tw-space-x-4">
          <a
            href="#services"
            className="tw-inline-flex tw-justify-center tw-items-center tw-py-3 tw-px-5 tw-text-base tw-font-medium tw-text-center tw-text-white tw-rounded-lg tw-bg-cyan-600 hover:tw-bg-cyan-700 focus:tw-ring-4 focus:tw-ring-cyan-300 dark:focus:tw-ring-cyan-950"
          >
            Our Services
            <svg
              className="tw-ml-2 tw--mr-1 tw-w-5 tw-h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </a>
          <Link
            to="/login"
            className="tw-inline-flex tw-justify-center tw-items-center tw-py-3 tw-px-5 tw-text-base tw-font-medium tw-text-center tw-text-gray-900 tw-rounded-lg tw-border tw-border-gray-300 hover:tw-bg-gray-100 focus:tw-ring-4 focus:tw-ring-gray-100 dark:tw-text-white dark:tw-border-gray-700 dark:hover:tw-bg-gray-700 dark:focus:tw-ring-gray-800"
          >
            Login
          </Link>
        </div>
      </div>
    </section>
    </>
  );
};

export default Hero;
