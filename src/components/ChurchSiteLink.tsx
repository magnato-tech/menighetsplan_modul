import React from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useCms } from "../context/CmsContext";
import { churchSiteUrl, hasChurchSite, signInBackUrl } from "../utils/surfaces";

type Props = Omit<LinkProps, "to"> & {
  /** When our website is on, the internal path (default `/`). */
  to?: string;
  /** Open the congregation site in a new tab when our website is off. */
  newTab?: boolean;
  /** Without any website to link to, show the children as plain text instead of nothing. */
  textWithoutSite?: boolean;
  /**
   * On a page outside the website (sign-in, login link, unsubscribe): the address set for «Tilbake til
   * nettsiden» wins, when there is one, and opens in the same tab.
   */
  outsideSite?: boolean;
};

/**
 * Links to `/` when our website is on, otherwise to the congregation's external site. Without any site
 * to link to, renders nothing, or the children as plain text when `textWithoutSite` is set.
 */
export const ChurchSiteLink: React.FC<Props> = ({ to = "/", newTab = false, textWithoutSite = false, outsideSite = false, children, ...rest }) => {
  const { surfaces } = useCms();
  const back = outsideSite ? signInBackUrl(surfaces) : null;
  if (back) {
    return (
      <a href={back} {...rest}>
        {children}
      </a>
    );
  }
  if (!hasChurchSite(surfaces)) {
    if (!textWithoutSite) return null;
    return (
      <span className={rest.className} title={rest.title} id={rest.id}>
        {children}
      </span>
    );
  }
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
