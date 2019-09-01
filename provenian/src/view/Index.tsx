import React, { useEffect } from "react";
import { Header, Image, Grid } from "semantic-ui-react";
import axios from "axios";
import { useAuth0 } from "../components/Auth0Provider";

const Index: React.FC = () => {
  const { isAuthenticated } = useAuth0() as any;
  useEffect(() => {
    (async () => {
      if (!isAuthenticated) return;

      console.log(
        (await axios.get(`${process.env.REACT_APP_FILE_STORAGE}/index.json`))
          .data
      );
    })();
  }, [isAuthenticated]);

  return (
    <Grid centered>
      <Grid.Row>
        <Grid.Column width={8}>
          <Header as="h2">ようこそ</Header>
          <Image src={`${process.env.PUBLIC_URL}/top_neko.jpg`} />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default Index;
