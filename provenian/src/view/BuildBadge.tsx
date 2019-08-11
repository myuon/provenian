import React from "react";
import { Label, Popup } from "semantic-ui-react";

const badgeColor = (status: string) => {
  if (status === "WJ") {
    return "grey";
  } else if (status === "V") {
    return "green";
  } else if (status === "CE") {
    return "orange";
  } else {
    return "violet";
  }
};

const BuildBadge: React.FC<{
  status_code: string;
  status_text: string;
  size?:
    | "big"
    | "small"
    | "massive"
    | "mini"
    | "tiny"
    | "medium"
    | "large"
    | "huge"
    | undefined;
}> = props => {
  return (
    <Popup
      content={props.status_text}
      trigger={
        <Label size={props.size} color={badgeColor(props.status_code)}>
          {props.status_code}
        </Label>
      }
    />
  );
};

export default BuildBadge;
