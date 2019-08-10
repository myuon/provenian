import React, { useState } from "react";
import {
  Segment,
  Form,
  Select,
  Header,
  Accordion,
  Icon
} from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import axios from "axios";
import { RouteComponentProps } from "react-router";

const languages = [
  {
    key: "coq",
    value: "coq",
    text: "Coq"
  },
  {
    key: "isabelle2019",
    value: "isabelle2019",
    text: "Isabelle (2019)"
  }
];

const Problem: React.FC<RouteComponentProps> = props => {
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

  const [sourceCode, setSourceCode] = useState("");
  const [language, setLanguage] = useState(-1);

  const submit = async () => {
    const result = await axios.post(
      `${process.env.REACT_APP_API_ENDPOINT}/submit`,
      sourceCode
    );
    console.log(result.data);

    props.history.push(`/submissions/${result.data.id}`);
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
          <Accordion.Title
            active={language === 0}
            index={0}
            onClick={() => setLanguage(language === 0 ? -1 : 0)}
          >
            <Icon name="dropdown" />
            Coq
          </Accordion.Title>
          <Accordion.Content active={language === 0}>
            <pre>Not yet implemented</pre>
          </Accordion.Content>

          <Accordion.Title
            active={language === 1}
            index={1}
            onClick={() => setLanguage(language === 1 ? -1 : 1)}
          >
            <Icon name="dropdown" />
            Isabelle
          </Accordion.Title>
          <Accordion.Content active={language === 1}>
            <pre>{template.isabelle}</pre>
          </Accordion.Content>
        </Accordion>
      </Segment>

      <Form>
        <Form.Field>
          <label>Language</label>
          <Select
            placeholder="Select language"
            options={languages}
            value={language === -1 ? undefined : languages[language].value}
          />
        </Form.Field>
        <Form.Field
          control={TextareaAutosize}
          label="Source Code"
          placeholder="code here..."
          style={{ ttfont }}
          value={sourceCode}
          onChange={(event: any) => setSourceCode(event.target.value)}
        />
        <Form.Button onClick={submit}>Submit</Form.Button>
      </Form>
    </>
  );
};

export default Problem;
