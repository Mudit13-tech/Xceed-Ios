import { Link } from "react-router-dom";

// `href` lets a service point somewhere other than the generic /services/:id
// template — the two newest modules have introduction pages of their own.
// `tag` is the optional pill beside the icon, matching the badges at the top of
// the hero so a newly launched module reads the same way in both places.
const ServiceCard = ({ id, icon, title, description, price, href, tag }) => {
  return (
    <div className="tw-flex-shrink-0 tw-p-5 tw-w-full">
      {/* Icon and tag share a row: the cards are a fixed height, so a pill on a
          line of its own would come out of the description below. */}
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-mb-4">
        <div className="tw-flex tw-justify-center tw-items-center tw-w-10 tw-h-10 tw-rounded-full lg:tw-h-12 lg:tw-w-12 tw-bg-cyan-900 *:tw-w-5 *:tw-h-5 tw-text-cyan-600 lg:*:tw-w-6 lg:*:tw-h-6 dark:tw-text-cyan-300">
          {icon}
        </div>
        {tag ? (
          <span className="tw-flex-shrink-0 tw-text-xs tw-font-bold tw-uppercase tw-whitespace-nowrap tw-rounded-full tw-bg-teal-500 tw-text-white tw-px-3 tw-py-1">
            {tag}
          </span>
        ) : null}
      </div>

      <h3 className="tw-font-bold tw-w-full dark:tw-text-white tw-text-[24px]">{title}</h3>
      <p className="tw-text-gray-500  tw-text-justify text-[16px] tw-text-[16px] dark:tw-text-gray-400 tw-line-clamp-4">
        {description}
      </p>
      <span>
          <Link to={href ?? `/services/${id}`} className="tw-text-cyan-600 dark:tw-text-cyan-300">
            {" "}
            Read more...
          </Link>
      </span>
      
      <p className="tw-flex tw-items-end tw-py-[10px] tw-flex-grow tw tw-font-bold tw-text-cyan-600 dark:tw-text-cyan-300 tw-italic ">
        {price}
      </p>
    </div>
  );
};

export default ServiceCard;
