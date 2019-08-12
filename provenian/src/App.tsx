import React from "react";
import { Container } from "semantic-ui-react";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Problem from "./view/Problem";
import Index from "./view/Index";
import Submission from "./view/Submission";
import NavBar from "./view/NavBar";
import EditProblem from "./view/EditProblem";

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <NavBar />

        <Container style={{ marginTop: "50px" }}>
          <Route exact path="/" component={Index} />
          <Route exact path="/problems/:problemId" component={Problem} />
          <Route path="/problems/:problemId/edit" component={EditProblem} />
          <Route path="/submissions/:submissionId" component={Submission} />
        </Container>
      </div>
    </Router>
  );
};

export default App;
