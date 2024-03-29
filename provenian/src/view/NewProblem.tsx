import React, { useState, useReducer, useCallback } from "react";
import { RouteComponentProps } from "react-router";
import { useAuth0 } from "../components/Auth0Provider";
import axios from "axios";
import { Form, Segment, Button, Table } from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import remark from "remark";
import reactRenderer from "remark-react";
import update from "immutability-helper";

const NewProblem: React.FC<RouteComponentProps> = props => {
  const { getTokenSilently } = useAuth0() as any;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, dispatchAttachments] = useReducer(
    (
      state: Array<{
        language: string;
        filename: string;
        code: string;
        timestamp: number;
      }>,
      action: {
        type: "append" | "delete" | "update";
        index?: number;
        value?: any;
      }
    ) => {
      switch (action.type) {
        case "append":
          return update(state, {
            $push: [
              {
                language: "language",
                filename: "file",
                code: "code",
                timestamp: new Date().getTime()
              }
            ]
          });
        case "delete":
          return state.filter((_, index) => index !== action.index);
        case "update":
          return update(state, {
            [action.index]: {
              [action.value.type]: {
                $set: action.value.value
              }
            }
          });
        default:
          throw new Error("unreachable");
      }
    },
    [
      {
        language: "isabelle",
        filename: "Goal.thy",
        code: `theory Goal
imports Submitted
begin

theorem "_"
by (rule goal)

end`,
        timestamp: new Date().getTime()
      },
      {
        language: "isabelle",
        filename: "ROOT",
        code: `session "all" = HOL +
theories [document = false]
  Submitted
  Goal`,
        timestamp: new Date().getTime() + 1
      }
    ]
  );

  const submit = useCallback(async () => {
    await axios.post(
      `${process.env.REACT_APP_API_ENDPOINT}/problems`,
      {
        title,
        content,
        content_type: "text/markdown",
        attachments: attachments
      },
      {
        headers: {
          Authorization: `Bearer ${await getTokenSilently()}`
        }
      }
    );

    props.history.push("/me/problems");
  }, [title, content, attachments]);

  return (
    <Form>
      <Form.Input
        label="タイトル"
        defaultValue={title}
        onChange={event => setTitle(event.target.value)}
      />
      <Form.Field>
        <label>本文</label>
        <TextareaAutosize
          defaultValue={content}
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
        <label>添付ファイル</label>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell singleLine>言語</Table.HeaderCell>
              <Table.HeaderCell>ファイル名</Table.HeaderCell>
              <Table.HeaderCell>コード</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {attachments.map(
              ({ language, filename, code, timestamp }, index) => (
                <Table.Row key={timestamp}>
                  <Table.Cell collapsing>
                    <Form.Input
                      defaultValue={language}
                      onChange={event =>
                        dispatchAttachments({
                          type: "update",
                          value: {
                            type: "language",
                            value: event.target.value
                          },
                          index
                        })
                      }
                    />
                  </Table.Cell>
                  <Table.Cell collapsing>
                    <Form.Input
                      defaultValue={filename}
                      onChange={event =>
                        dispatchAttachments({
                          type: "update",
                          value: {
                            type: "filename",
                            value: event.target.value
                          },
                          index
                        })
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Form.Field>
                      <TextareaAutosize
                        defaultValue={code}
                        onChange={event =>
                          dispatchAttachments({
                            type: "update",
                            value: { type: "code", value: event.target.value },
                            index
                          })
                        }
                      />
                    </Form.Field>
                  </Table.Cell>
                  <Table.Cell collapsing>
                    <Button
                      color={"red"}
                      onClick={() =>
                        dispatchAttachments({
                          type: "delete",
                          index
                        })
                      }
                    >
                      削除
                    </Button>
                  </Table.Cell>
                </Table.Row>
              )
            )}
            <Table.Row>
              <Table.Cell />
              <Table.Cell />
              <Table.Cell>
                <Form.Field>
                  <Button
                    onClick={() =>
                      dispatchAttachments({
                        type: "append"
                      })
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
        送信
      </Form.Button>
    </Form>
  );
};

export default NewProblem;
