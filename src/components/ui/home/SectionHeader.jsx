import clsx from 'clsx';
// `subtitle` is part of the heading, on a line of its own beneath it — a
// qualifier like a batch year belongs with the title but would swamp it if it
// ran on, since everything after the first word is underlined.
const SectionHeader = ({ title, subtitle, centered }) => {
  return (
    <h1
      className={clsx(
        'tw-text-4xl tw-font-extrabold tw-text-gray-900 md:tw-text-4xl lg:tw-text-4xl dark:tw-text-white tw-mb-5',
        centered ? 'tw-text-center' : 'md:tw-text-left'
      )}
    >
      {title.split(' ')[0]}{' '}
      <span className="tw-underline tw-underline-offset-4 tw-decoration-4 tw-decoration-cyan-600 dark:tw-decoration-cyan-300">
        {title.split(' ').slice(1).join(' ')}
      </span>
      {subtitle ? (
        <span className="tw-block tw-mt-2 tw-text-lg tw-font-semibold tw-text-cyan-600 dark:tw-text-cyan-300">
          {subtitle}
        </span>
      ) : null}
    </h1>
  );
};

export default SectionHeader;
