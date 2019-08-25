import React, { useState, useEffect, createRef } from "react";
import { Form, Segment, Button, Table } from "semantic-ui-react";
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
  onSubmit: () => void;
}> = props => {
  const [content, setContent] = useState("");
  const [templateArray, setTemplateArray] = useState([]);
  const [title, setTitle] = useState("");

  return (
    <Form>
      <Form.Input
        label="タイトル"
        defaultValue={props.problem.title}
        onChange={event => setTitle(event.target.value)}
      />
      <Form.Field>
        <label>本文</label>
        <TextareaAutosize
          defaultValue={props.problem.content}
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
      <Form.Button primary onClick={props.onSubmit}>
        保存
      </Form.Button>
    </Form>
  );
};

export default ProblemForm;
