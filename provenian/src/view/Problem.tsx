import React, { useState, useEffect } from "react";
import {
  Segment,
  Form,
  Select,
  Header,
  Accordion,
  Icon,
  Label
} from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import axios from "axios";
import { RouteComponentProps } from "react-router";

const languages: { [key: string]: { text: string; color: string } } = {
  coq: {
    text: "Coq",
    color: "grey"
  },
  isabelle2019: {
    text: "Isabelle (2019)",
    color: "yellow"
  }
};

const Problem: React.FC<RouteComponentProps<{ problemId: string }>> = props => {
  const ttfont = {
    "font-family": "Consolas, 'Courier New', Courier, Monaco, monospace",
    "font-size": "14px",
    "line-height": "1.2"
  };

  const [sourceCode, setSourceCode] = useState("");
  const [language, setLanguage] = useState("");
  const [problem, setProblem] = useState({} as {
    title: string;
    content: string;
    content_type: string;
    template: { [key: string]: string };
  });
  const [supportedLangs, setSupportedLangs] = useState([] as string[]);

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
      `${process.env.REACT_APP_API_ENDPOINT}/submit`,
      sourceCode
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
