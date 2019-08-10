import React from "react";
import { Segment, Menu, Container, Grid } from "semantic-ui-react";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import Problem from "./view/Problem";
import Index from "./view/Index";
import Submission from "./view/Submission";

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Segment>
          <Menu fixed="top" inverted={true}>
            <Menu.Item>
              <Link to={"/"}>Provenian</Link>
            </Menu.Item>
          </Menu>
        </Segment>

        <Grid centered>
          <Grid.Column width={6}>
            <Container>
              <Route exact path="/" component={Index} />
              <Route path="/problems/" component={Problem} />
              <Route path="/submissions/" component={Submission} />
            </Container>
          </Grid.Column>
        </Grid>
      </div>
    </Router>
  );
};

export default App;
