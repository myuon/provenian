import React, { useState, useEffect } from "react";
import { Form, Segment, Button, Table, Message } from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import remark from "remark";
import reactRenderer from "remark-react";

interface ProblemDetail {
  title: string;
  content: string;
  content_type: string;
  template: { [key: string]: string };
}

const ProblemForm: React.FC<{
  problem: ProblemDetail;
  draft: boolean;
  onSubmit: (arg: {
    title: string;
    content: string;
    template: { [key: string]: string };
  }) => void;
  onPublish?: () => void;
}> = props => {
  const [content, setContent] = useState("");
  const [templateArray, setTemplateArray] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    setContent(props.problem.content);
    setTitle(props.problem.title);

    if (props.problem.template) {
      setTemplateArray(Object.entries(props.problem.template));
    }
  }, [props.problem]);

  return (
    <Form>
      <Message>
        <p>この問題は現在下書きの状態です。</p>
      </Message>

      <Form.Input
        label="タイトル"
        defaultValue={title}
        onChange={event => setTitle(event.target.value)}
      />
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
      {props.draft && (
        <Button secondary onClick={() => props.onPublish()}>
          問題を公開
        </Button>
      )}
      <Button
        primary
        onClick={() =>
          props.onSubmit({
            title,
            content,
            template: Object.fromEntries(templateArray)
          })
        }
      >
        保存
      </Button>
    </Form>
  );
};

export default ProblemForm;
