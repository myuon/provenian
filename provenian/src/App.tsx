import React from "react";
import { Segment, Menu, Container, Grid } from "semantic-ui-react";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import Problem from "./view/Problem";
import Index from "./view/Index";
import Submission from "./view/Submission";
import NavBar from "./view/NavBar";

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <NavBar />

        <Container style={{ marginTop: "50px" }}>
          <Grid centered>
            <Grid.Column width={8}>
              <Route exact path="/" component={Index} />
              <Route path="/problems/" component={Problem} />
              <Route path="/submissions/:submissionId" component={Submission} />
            </Grid.Column>
          </Grid>
        </Container>
      </div>
    </Router>
  );
};

export default App;
