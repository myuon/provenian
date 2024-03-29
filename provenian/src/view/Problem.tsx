import React, { useState, useEffect } from "react";
import { Tab, Table } from "semantic-ui-react";
import axios from "axios";
import { RouteComponentProps } from "react-router";
import { Link } from "react-router-dom";
import BuildBadge from "./BuildBadge";
import { useAuth0 } from "../components/Auth0Provider";
import EditProblem from "./EditProblem";
import ShowProblem from "./problem/ShowProblem";
import { ProblemDetail } from "../types";

export const languages: { [key: string]: { text: string; color: string } } = {
  coq: {
    text: "Coq",
    color: "grey"
  },
  isabelle2019: {
    text: "Isabelle (2019)",
    color: "yellow"
  }
};

const Content: React.FC<
  RouteComponentProps<{ problemId: string }> & { draft: boolean }
> = props => {
  const [problem, setProblem] = useState<ProblemDetail>();
  const {
    isAuthenticated,
    loginWithRedirect,
    getTokenSilently
  } = useAuth0() as any;
  const [fileContents, setFileContents] = useState<
    { filename: string; content: string }[]
  >();

  useEffect(() => {
    (async () => {
      const result: ProblemDetail = (await axios.get(
        `${process.env.REACT_APP_FILE_STORAGE}/${props.match.params.problemId}${
          props.draft ? ".draft" : ""
        }.json`
      )).data;

      if (result.version !== "1.0") {
        return;
      }

      setProblem(result);

      const files = (await Promise.all(
        Object.entries(result.files).map(([language, files]) =>
          Promise.all(
            files.map(async file => ({
              filename: `${language}/${file}`,
              content: (await axios.get(
                `${process.env.REACT_APP_FILE_STORAGE}${
                  props.draft ? "/draft" : ""
                }/${props.match.params.problemId}/${language}/${file}`
              )).data
            }))
          )
        )
      )).flat();
      setFileContents(files);
    })();
  }, [props.match.params.problemId]);

  const submit = async ({ language, sourceCode }) => {
    const result = await axios.post(
      `${process.env.REACT_APP_API_ENDPOINT}/problems/${props.match.params.problemId}/submit`,
      {
        language,
        code: sourceCode
      },
      {
        headers: {
          Authorization: `Bearer ${await getTokenSilently()}`
        }
      }
    );
    props.history.push(`/submissions/${result.data.id}`);
  };

  if (!problem || !fileContents) {
    return <>loading...</>;
  }

  return (
    <ShowProblem
      problem={Object.assign(problem, { files: fileContents })}
      languages={[]}
      isAuthenticated={isAuthenticated}
      onLogin={loginWithRedirect}
      onSubmit={submit}
      draft={props.draft}
    />
  );
};

const Submissions: React.FC<
  RouteComponentProps<{ problemId: string }> & {
    submissions?: {
      id: string;
      created_at: number;
      language: string;
      result: { status_code: string; status_text: string };
    }[];
  }
> = props => {
  if (props.submissions) {
    return (
      <Table celled compact>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>ID</Table.HeaderCell>
            <Table.HeaderCell>提出日時</Table.HeaderCell>
            <Table.HeaderCell>結果</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {props.submissions.map(submission => (
            <Table.Row key={submission.id}>
              <Table.Cell>{submission.id}</Table.Cell>
              <Table.Cell>
                {new Date(submission.created_at * 1000).toLocaleString()}
              </Table.Cell>
              <Table.Cell>
                <BuildBadge
                  status_code={submission.result.status_code}
                  status_text={submission.result.status_text}
                />
              </Table.Cell>
              <Table.Cell>
                <Link to={`/submissions/${submission.id}`}>詳細</Link>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    );
  } else {
    return <div>Now loading...</div>;
  }
};

const Problem: React.FC<
  RouteComponentProps<{ problemId: string }> & { draft: boolean }
> = props => {
  const [submissions, setSubmissions] = useState(undefined);
  const { isWriter } = useAuth0() as any;

  // A flag for lazy loading
  const [shouldLoadSubmissions, setShouldLoadSubmissions] = useState(false);
  useEffect(() => {
    if (!shouldLoadSubmissions) return;

    (async () => {
      const result = await axios.get(
        `${process.env.REACT_APP_API_ENDPOINT}/problems/${props.match.params.problemId}/submissions`
      );

      setSubmissions(result.data || []);
    })();
  }, [props.match.params.problemId, shouldLoadSubmissions]);

  return (
    <Tab
      menu={{ secondary: true, pointing: true }}
      panes={[
        {
          menuItem: "問題",
          render: () => <Content draft={props.draft} {...props} />
        },
        !props.draft
          ? {
              menuItem: "提出された解答",
              render: () => <Submissions {...props} submissions={submissions} />
            }
          : undefined,
        isWriter
          ? {
              menuItem: "この問題を編集",
              render: () => <EditProblem draft={props.draft} {...props} />
            }
          : undefined
      ]}
      onTabChange={(_, prop) =>
        prop.activeIndex !== prop.defaultActiveIndex &&
        setShouldLoadSubmissions(true)
      }
    />
  );
};

export default Problem;
