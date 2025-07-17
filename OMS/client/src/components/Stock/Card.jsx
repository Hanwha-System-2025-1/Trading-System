import React from "react";

const Card = (props) => {
  const { children, className, size } = props;
  const width = size === "medium" ? "w-[300px]" : "w-52";
  const height = size === "medium" ? "h-32" : "h-[88px]";
  const padding = size === "medium" ? "p-3" : "p-2";
  const combinedClassName =
    `${width} ${height} ${padding} bg-white border border-solid rounded-lg border-neutral-300 ` +
    (className || "");

  return <div className={combinedClassName}>{children}</div>;
};

export default Card;
