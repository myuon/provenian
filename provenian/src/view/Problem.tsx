import React, { useState, useEffect } from "react";
import {
  Segment,
  Form,
  Select,
  Header,
  Accordion,
  Icon,
  Label,
  Tab,
  Table,
  Button
} from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import axios from "axios";
import { RouteComponentProps } from "react-router";
import { Link } from "react-router-dom";
import BuildBadge from "./BuildBadge";
import { useAuth0 } from "../components/Auth0Provider";

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

const Content: React.FC<RouteComponentProps<{ problemId: string }>> = props => {
  const [sourceCode, setSourceCode] = useState("");
  const [language, setLanguage] = useState("");
  const [problem, setProblem] = useState({} as {
    title: string;
    content: string;
    content_type: string;
    template: { [key: string]: string };
  });
  const [supportedLangs, setSupportedLangs] = useState([] as string[]);
  const {
    isAuthenticated,
    loginWithRedirect,
    getTokenSilently
  } = useAuth0() as any;

  useEffect(() => {
    (async () => {
      const { version, ...result } = (await axios.get(
        `${process.env.REACT_APP_FILE_STORAGE}/${
          props.match.params.problemId
        }.json`
      )).data;

      if (version !== "1.0") {
        return;
      }

      setProblem(result);
      setSupportedLangs(Object.keys(result.template));
    })();
  }, [props.match.params.problemId]);

  const submit = async () => {
    const result = await axios.post(
      `${process.env.REACT_APP_API_ENDPOINT}/problems/${
        props.match.params.problemId
      }/submit`,
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

  return (
    <>
      <Header as="h2">{problem.title}</Header>
      <p>{problem.content}</p>

      <div>
        <span>対応言語:</span>
        {supportedLangs.map(lang => (
          <Label key={lang} color={languages[lang].color as any}>
            {lang}
          </Label>
        ))}
      </div>

      <p>検証時間制限: 10sec / メモリ上限: 1500MB</p>

      <Header as="h4">言語テンプレート</Header>
      <p>ソースコードは次のテンプレートに従って提出せよ。</p>

      <Segment>
        <Accordion>
          {supportedLangs.map(lang => (
            <div key={lang}>
              <Accordion.Title
                active={language === lang}
                index={lang}
                onClick={() => setLanguage(language === lang ? "" : lang)}
              >
                <Icon name="dropdown" />
                {languages[lang].text}
              </Accordion.Title>
              <Accordion.Content active={language === lang}>
                <pre>{problem.template[lang]}</pre>
              </Accordion.Content>
            </div>
          ))}
        </Accordion>
      </Segment>

      {!isAuthenticated ? (
        <Button primary onClick={() => loginWithRedirect({})}>
          ログインして解答を提出
        </Button>
      ) : (
        <Form>
          <Form.Field>
            <label>Language</label>
            <Select
              placeholder="Select language"
              options={Object.keys(languages).map(name => ({
                key: name,
                value: name,
                text: languages[name].text
              }))}
              value={language}
            />
          </Form.Field>
          <Form.Field
            control={TextareaAutosize}
            label="Source Code"
            placeholder="code here..."
            value={sourceCode}
            onChange={(event: any) => setSourceCode(event.target.value)}
          />
          <Form.Button onClick={submit}>Submit</Form.Button>
        </Form>
      )}
    </>
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

const Problem: React.FC<RouteComponentProps<{ problemId: string }>> = props => {
  const [submissions, setSubmissions] = useState(undefined);

  // A flag for lazy loading
  const [shouldLoadSubmissions, setShouldLoadSubmissions] = useState(false);
  useEffect(() => {
    if (!shouldLoadSubmissions) return;

    (async () => {
      const result = await axios.get(
        `${process.env.REACT_APP_API_ENDPOINT}/problems/${
          props.match.params.problemId
        }/submissions`
      );

      setSubmissions(result.data || []);
    })();
  }, [props.match.params.problemId, shouldLoadSubmissions]);

  return (
    <Tab
      menu={{ secondary: true, pointing: true }}
      panes={[
        { menuItem: "問題", render: () => <Content {...props} /> },
        {
          menuItem: "提出された解答",
          render: () => <Submissions {...props} submissions={submissions} />
        }
      ]}
      onTabChange={(_, prop) =>
        prop.activeIndex !== prop.defaultActiveIndex &&
        setShouldLoadSubmissions(true)
      }
    />
  );
};

export default Problem;
