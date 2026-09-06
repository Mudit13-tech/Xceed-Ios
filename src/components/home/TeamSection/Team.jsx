import clsx from 'clsx';
import SectionHeader from '../../ui/home/SectionHeader';
import TeamCard from './TeamCard';

const Team = ({ title, subtitle, desp, teamData, variant }) => {
  if (!teamData) {
    return null;
  }

  return (
    <section id="team" className="tw-bg-gray-900">
      <div className="tw-py-8 tw-px-4 tw-mx-auto tw-max-w-screen-xl sm:tw-py-16 lg:tw-px-6">
        <div className="tw-font-light tw-text-gray-500 sm:tw-text-lg dark:tw-text-gray-400 tw-mx-auto  lg:tw-w-1/2 tw-text-center tw-mb-4">
          <SectionHeader title={title} subtitle={subtitle} centered />
          <p className="tw-mb-8">{desp}</p>
        </div>
        {typeof teamData === 'string' ? (
          <p className="tw-text-center">
            Check out the people involved in this project <br />
            <a
              href={teamData}
              target="_blank"
              rel="noreferrer"
              className="tw-text-cyan-600 dark:tw-text-cyan-300 hover:tw-underline tw-text-xl tw-font-bold my-5 tw-block"
            >
              here
            </a>
          </p>
        ) : (
          <div
            className={clsx(
              'tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-justify-center tw-gap-4 lg:tw-gap-8',
              // Two faculty mentors in a three-column grid sat off to the left
              // with an empty column beside them. Six columns, each card
              // spanning two of them and the first starting at column 2, puts
              // one empty track on each side — so the pair is centred and the
              // cards keep the width they have in the founding grid: a 2-of-6
              // span works out to exactly a 1-of-3 span, gaps included.
              variant === 'faculty' &&
                'lg:tw-grid-cols-6 lg:*:tw-col-span-2 lg:[&>*:first-child]:tw-col-start-2'
            )}
          >
            {teamData.map((member) => (
              <TeamCard
                key={member.id}
                name={member.name}
                designation={member.designation}
                currentRole={member.currentRole}
                image={member.image}
                github={member.github}
                linkedin={member.linkedin}
                variant={variant}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Team;
