import React from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useCms } from "../context/CmsContext";
import { churchSiteUrl } from "../utils/surfaces";

type Props = Omit<LinkProps, "to"> & {
  /** When our website is on, the internal path (default `/`). */
  to?: string;
  /** Open the congregation site in a new tab when our website is off. */
  newTab?: boolean;
};

/** Links to `/` when our website is on, otherwise to the congregation's external site. */
export const ChurchSiteLink: React.FC<Props> = ({ to = "/", newTab = false, children, ...rest }) => {
  const { surfaces } = useCms();
  const external = !surfaces.ownWebsite ? churchSiteUrl(surfaces) : null;
  if (external) {
    return (
      <a href={external} target={newTab ? "_blank" : undefined} rel={newTab ? "noreferrer" : undefined} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} target={newTab ? "_blank" : undefined} rel={newTab ? "noreferrer" : undefined} {...rest}>
      {children}
    </Link>
  );
};
