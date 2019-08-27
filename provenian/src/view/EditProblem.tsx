import React, { useState, useEffect } from "react";
import { RouteComponentProps } from "react-router";
import { useAuth0 } from "../components/Auth0Provider";
import axios from "axios";
import ProblemForm from "./problem/ProblemForm";

const EditProblem: React.FC<
  RouteComponentProps<{ problemId: string }> & { draft: boolean }
> = props => {
  const [problem, setProblem] = useState({} as {
    title: string;
    content: string;
    content_type: string;
    files: [string, string[]][];
  });
  const { getTokenSilently } = useAuth0() as any;

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    (async () => {
      const { version, ...result } = (await axios.get(
        `${process.env.REACT_APP_FILE_STORAGE}/${props.match.params.problemId}${
          props.draft ? ".draft" : ""
        }.json`
      )).data;

      if (version !== "1.0") {
        return;
      }

      setProblem(result);

      setTitle(result.title);
      setContent(result.content);
    })();
  }, [props.match.params.problemId]);

  const submit = async () => {
    const result = await axios.put(
      `${process.env.REACT_APP_API_ENDPOINT}/problems/${props.match.params.problemId}/edit`,
      {
        title,
        content,
        content_type: "text/markdown"
      },
      {
        headers: {
          Authorization: `Bearer ${await getTokenSilently()}`
        }
      }
    );
    props.history.push(`/submissions/${result.data.id}`);
  };

  const publish = async () => {
    await axios.put(
      `${process.env.REACT_APP_API_ENDPOINT}/problems/${props.match.params.problemId}/publish`,
      null,
      {
        headers: {
          Authorization: `Bearer ${await getTokenSilently()}`
        }
      }
    );
    props.history.push(`/problems/${props.match.params.problemId}`);
  };

  return (
    <ProblemForm
      draft={props.draft}
      problem={problem}
      onSubmit={submit}
      onPublish={publish}
    ></ProblemForm>
  );
};

export default EditProblem;
