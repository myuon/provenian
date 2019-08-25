import React, { useState } from "react";
import {
  Header,
  Segment,
  Accordion,
  Label,
  Icon,
  Button,
  Form,
  Select
} from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";

const ShowProblem: React.FC<{
  problem: any;
  languages: { value: string; label: string; color: string }[];
  isAuthenticated?: boolean;
  onLogin: () => void;
  onSubmit: (arg: { language: string; sourceCode: string }) => void;
}> = props => {
  const problem = props.problem;
  const isAuthenticated = props.isAuthenticated || false;

  const [accordion, setAccordion] = useState("");
  const [language, setLanguage] = useState("");
  const [sourceCode, setSourceCode] = useState("");

  return (
    <>
      <Header as="h2">{problem.title}</Header>
      <p>{problem.content}</p>

      <div>
        <span>対応言語:</span>
        {props.languages.map(lang => (
          <Label key={lang.value} color={lang.color as any}>
            {lang}
          </Label>
        ))}
      </div>

      <p>検証時間制限: 10sec / メモリ上限: 1500MB</p>

      <Header as="h4">言語テンプレート</Header>
      <p>ソースコードは次のテンプレートに従って提出せよ。</p>

      <Segment>
        <Accordion>
          {props.languages.map(lang => (
            <div key={lang.value}>
              <Accordion.Title
                active={accordion === lang.value}
                index={lang.value}
                onClick={() =>
                  setAccordion(accordion === lang.value ? "" : lang.value)
                }
              >
                <Icon name="dropdown" />
                {lang.label}
              </Accordion.Title>
              <Accordion.Content active={accordion === lang.value}>
                <pre>{problem.template[lang.value]}</pre>
              </Accordion.Content>
            </div>
          ))}
        </Accordion>
      </Segment>

      {!isAuthenticated ? (
        <Button primary onClick={props.onLogin}>
          ログインして解答を提出
        </Button>
      ) : (
        <Form>
          <Form.Field>
            <label>Language</label>
            <Select
              placeholder="Select language"
              options={props.languages.map(language => ({
                key: language.value,
                value: language.value,
                text: language.label
              }))}
              defaultValue={language}
              onChange={(event: any) => setLanguage(event.target.value)}
            />
          </Form.Field>
          <Form.Field
            control={TextareaAutosize}
            label="Source Code"
            placeholder="code here..."
            value={sourceCode}
            onChange={(event: any) => setSourceCode(event.target.value)}
          />
          <Form.Button onClick={() => props.onSubmit({ language, sourceCode })}>
            Submit
          </Form.Button>
        </Form>
      )}
    </>
  );
};

export default ShowProblem;
