import React, { useEffect, useState } from "react";
import { Header, Label, Popup } from "semantic-ui-react";
import axios from "axios";
import { RouteComponentProps } from "react-router";

const Submission: React.FC<
  RouteComponentProps<{ submissionId: string }>
> = props => {
  const [judgeResult, setJudgeResult] = useState({} as any);
  const [statusCodeColor, setStatusCodeColor] = useState("grey" as
    | "red"
    | "orange"
    | "yellow"
    | "olive"
    | "green"
    | "teal"
    | "blue"
    | "violet"
    | "purple"
    | "pink"
    | "brown"
    | "grey"
    | "black");
  const [source, setSource] = useState("");

  useEffect(() => {
    (async () => {
      const { code, result } = (await axios.get(
        `${process.env.REACT_APP_API_ENDPOINT}/submissions/${
          props.match.params.submissionId
        }`
      )).data;

      setSource(code);
      setJudgeResult(result);

      const statusCode = result.status_code;
      setStatusCodeColor(
        statusCode === "WJ"
          ? "grey"
          : statusCode === "V"
          ? "green"
          : statusCode === "CE"
          ? "red"
          : "violet"
      );
    })();
  }, [props.match.params.submissionId]);

  return (
    <>
      <Header as="h2">提出</Header>
      <Popup
        content={judgeResult.status_text}
        trigger={
          <Label size="massive" color={statusCodeColor}>
            {judgeResult.status_code}
          </Label>
        }
      />

      <Header as="h2">結果</Header>

      <Header as="h4">ビルド出力</Header>
      <code>
        <pre>{judgeResult.message}</pre>
      </code>

      <Header as="h4">提出コード</Header>
      <code>
        <pre>{source}</pre>
      </code>
    </>
  );
};

export default Submission;