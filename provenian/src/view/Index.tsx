import React from "react";
import { Link } from "react-router-dom";
import { Header, Image, Grid } from "semantic-ui-react";

const Index: React.FC = () => {
  return (
    <Grid centered>
      <Grid.Row>
        <Grid.Column width={8}>
          <Header as="h2">ようこそ</Header>
          <Image src={`${process.env.PUBLIC_URL}/top_neko.jpg`} />

          <Header as="h2">問題一覧</Header>
          <ul>
            <li>
              <Link to={"/problems/rev-append"}>Reversely Appended</Link>
            </li>
            <li>
              <Link to={"/problems/sum-1-n"}>Sums up to N</Link>
            </li>
          </ul>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default Index;
