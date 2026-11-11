import React from "react";
import { minSideFrameClass, type MinSideFrameWidth } from "../../utils/minSideFrame";

interface MinSideFrameProps {
  width?: MinSideFrameWidth;
  /** The page has the menu fixed at the bottom of a phone: room is left for it */
  bottomNavRoom?: boolean;
  /** Extra classes for this page, added after the frame's own */
  className?: string;
  children: React.ReactNode;
}

/** The card a Min side page sits in. Its width and classes are in utils/minSideFrame.ts. */
export const MinSideFrame: React.FC<MinSideFrameProps> = ({ width = "wide", bottomNavRoom = false, className, children }) => {
  const frame = minSideFrameClass(width, bottomNavRoom);
  return <div className={className ? `${frame} ${className}` : frame}>{children}</div>;
};
