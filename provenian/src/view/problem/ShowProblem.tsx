import React, { useState } from "react";
import {
  Header,
  Label,
  Button,
  Form,
  Select,
  Message,
  Tab
} from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import { ProblemDetail } from "../../types";

const ShowProblem: React.FC<{
  problem: Omit<ProblemDetail, "files"> & {
    files: { filename: string; content: string }[];
  };
  languages: { value: string; label: string; color: string }[];
  isAuthenticated?: boolean;
  onLogin: () => void;
  onSubmit: (arg: { language: string; sourceCode: string }) => void;
  draft: boolean;
}> = props => {
  const problem = props.problem;
  const isAuthenticated = props.isAuthenticated || false;

  const [language, setLanguage] = useState("");
  const [sourceCode, setSourceCode] = useState("");

  if (!problem) {
    return <>loading...</>;
  }

  return (
    <>
      {props.draft && (
        <Message>
          <p>この問題は現在下書きの状態です。</p>
        </Message>
      )}

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

      <Header as="h4">言語ファイル</Header>
      <p>問題には次のファイルが用意されている。</p>

      <Tab
        panes={props.problem.files.map(file => ({
          menuItem: file.filename,
          render: () => (
            <Tab.Pane>
              <pre>
                <code>{file.content}</code>
              </pre>
            </Tab.Pane>
          )
        }))}
        style={{ marginBottom: "1rem" }}
      />

      {!isAuthenticated ? (
        <Button primary onClick={props.onLogin}>
          ログインして解答を提出
        </Button>
      ) : (
        <Form>
          <Header as="h4">提出</Header>

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
          <Form.Button
            primary
            onClick={() => props.onSubmit({ language, sourceCode })}
          >
            提出
          </Form.Button>
        </Form>
      )}
    </>
  );
};

export default ShowProblem;
