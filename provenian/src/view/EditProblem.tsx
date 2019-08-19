import React, { useState, useEffect, createRef } from "react";
import { RouteComponentProps } from "react-router";
import { useAuth0 } from "../components/Auth0Provider";
import axios from "axios";
import { Form, Segment, Button, Table } from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import remark from "remark";
import reactRenderer from "remark-react";

const EditProblem: React.FC<
  RouteComponentProps<{ problemId: string }>
> = props => {
  const [problem, setProblem] = useState({} as {
    title: string;
    content: string;
    content_type: string;
    template: { [key: string]: string };
  });
  const {
    isAuthenticated,
    loginWithRedirect,
    getTokenSilently
  } = useAuth0() as any;

  const [content, setContent] = useState("");
  const [templateArray, setTemplateArray] = useState([]);
  const [title, setTitle] = useState("");

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

      setTitle(result.title);
      setContent(result.content);
      setTemplateArray(Object.entries(result.template));
    })();
  }, [props.match.params.problemId]);

  const submit = async () => {
    console.log({
      title,
      content,
      content_type: "text/markdown",
      template: Object.fromEntries(templateArray)
    });

    const result = await axios.put(
      `${process.env.REACT_APP_API_ENDPOINT}/problems/${
        props.match.params.problemId
      }/edit`,
      {
        title,
        content,
        content_type: "text/markdown",
        template: Object.fromEntries(templateArray)
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
    <Form>
      <Form.Input label="タイトル" defaultValue={problem.title} value={title} />
      <Form.Field>
        <label>本文</label>
        <TextareaAutosize
          value={content}
          onChange={event => setContent(event.target.value)}
        />
        <Segment secondary>
          {
            remark()
              .use(reactRenderer, {
                sanitize: false
              })
              .processSync(content).contents
          }
        </Segment>
      </Form.Field>
      <Form.Field>
        <label>テンプレート</label>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell singleLine>言語</Table.HeaderCell>
              <Table.HeaderCell>テンプレート</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {templateArray.map(([language, text], index) => (
              <Table.Row key={index}>
                <Table.Cell collapsing>
                  <Form.Input value={language} />
                </Table.Cell>
                <Table.Cell>
                  <Form.Field>
                    <TextareaAutosize value={text} />
                  </Form.Field>
                </Table.Cell>
                <Table.Cell collapsing>
                  <Button
                    color={"red"}
                    onClick={() =>
                      setTemplateArray(
                        templateArray.filter((_, i) => (i /= index))
                      )
                    }
                  >
                    削除
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
            <Table.Row>
              <Table.Cell />
              <Table.Cell />
              <Table.Cell>
                <Form.Field>
                  <Button
                    onClick={() =>
                      setTemplateArray(
                        templateArray.concat([["Language", "Template"]])
                      )
                    }
                  >
                    追加
                  </Button>
                </Form.Field>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </Form.Field>
      <Form.Button primary onClick={submit}>
        Submit
      </Form.Button>
    </Form>
  );
};

export default EditProblem;
