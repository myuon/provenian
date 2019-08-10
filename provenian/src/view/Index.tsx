import React from "react";
import { Link } from "react-router-dom";
import { Header } from "semantic-ui-react";

const Index: React.FC = () => {
  return (
    <>
      <Header as="h2">問題一覧</Header>
      <ul>
        <li>
          <Link to={"/problems/rev-append"}>Reversely Appended</Link>
        </li>
      </ul>
    </>
  );
};

export default Index;
