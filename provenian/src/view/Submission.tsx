import React, { useEffect, useState } from "react";
import { Header } from "semantic-ui-react";
import axios from "axios";
import { RouteComponentProps } from "react-router";
import BuildBadge from "./BuildBadge";

const Submission: React.FC<
  RouteComponentProps<{ submissionId: string }>
> = props => {
  const [judgeResult, setJudgeResult] = useState({} as any);
  const [source, setSource] = useState("");

  useEffect(() => {
    (async () => {
      const { code, result } = (await axios.get(
        `${process.env.REACT_APP_API_ENDPOINT}/submissions/${
          props.match.params.submissionId
        }`
      )).data;

      axios
        .get(`${process.env.REACT_APP_FILE_STORAGE}/${code}`)
        .then(result => {
          setSource(result.data);
        });
      setJudgeResult(result);
    })();
  }, [props.match.params.submissionId]);

  return (
    <>
      <Header as="h2">提出</Header>
      <BuildBadge
        size="massive"
        status_code={judgeResult.status_code}
        status_text={judgeResult.status_text}
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
