import React from "react";
import {
  Segment,
  Form,
  Select,
  Header,
  Accordion,
  Icon
} from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";

const languages = [
  {
    key: "isabelle2019",
    value: "isabelle2019",
    text: "Isabelle (2019)"
  }
];

const Problem: React.FC = () => {
  const ttfont = {
    "font-family": "Consolas, 'Courier New', Courier, Monaco, monospace",
    "font-size": "14px",
    "line-height": "1.2"
  };

  const template = {
    isabelle: `theory Submitted
imports Main

begin

theorem goal: "even (length (xs @ rev xs))"
sorry

end
`
  };

  return (
    <>
      <Header as="h2">Reversely Appended</Header>
      <p>
        Q. リスト<code>xs</code>を反転させたものを<code>rev xs</code>
        と書くことにする。
        <code>xs</code>と<code>rev xs</code>
        を連結させて作ったリストの長さが偶数であることを示せ。
      </p>

      <p>検証時間制限: 10sec / メモリ上限: 1500MB</p>

      <Header as="h4">言語テンプレート</Header>
      <p>ソースコードは次のテンプレートに従って提出せよ。</p>

      <Segment>
        <Accordion>
          <Accordion.Title active={false} index={1}>
            <Icon name="dropdown" />
            Coq
          </Accordion.Title>
          <Accordion.Content active={false} />

          <Accordion.Title active={true} index={0}>
            <Icon name="dropdown" />
            Isabelle
          </Accordion.Title>
          <Accordion.Content active={true}>
            <pre>{template.isabelle}</pre>
          </Accordion.Content>
        </Accordion>
      </Segment>

      <Form>
        <Form.Field>
          <label>Language</label>
          <Select placeholder="Select language" options={languages} />
        </Form.Field>
        <Form.Field
          control={TextareaAutosize}
          label="Source Code"
          placeholder="code here..."
          style={{ ttfont }}
        />
        <Form.Button>Submit</Form.Button>
      </Form>
    </>
  );
};

export default Problem;
