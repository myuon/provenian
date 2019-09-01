import React, { useState, useEffect } from "react";
import {
  Header,
  Label,
  Button,
  Form,
  Message,
  Tab,
  Dropdown
} from "semantic-ui-react";
import TextareaAutosize from "react-textarea-autosize";
import { ProblemDetail } from "../../types";

const getLanguageName = (language: string) => {
  if (language === "isabelle") {
    return "Isabelle (2019)";
  }

  throw new Error("unreachable");
};

const getLanguageColor = (language: string) => {
  if (language === "isabelle") {
    return "yellow";
  }

  throw new Error("unreachable");
};

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
  const [languageOptions, setLanguageOptions] = useState<
    { key: string; value: string; text: string }[]
  >([]);

  useEffect(() => {
    setLanguageOptions(
      problem.languages.map(language => ({
        key: language,
        value: language,
        text: getLanguageName(language)
      }))
    );
  }, [problem.languages]);

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
        {props.problem.languages.map(lang => (
          <Label key={lang} color={getLanguageColor(lang) as any}>
            {lang}
          </Label>
        ))}
      </div>

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
            <label>言語</label>

            <Dropdown
              selection
              placeholder="言語"
              options={languageOptions}
              onChange={(_, { value }) => {
                setLanguage(value as string);
              }}
            />
          </Form.Field>
          <Form.Field
            control={TextareaAutosize}
            label="ソースコード"
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
