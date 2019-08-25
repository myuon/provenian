import React, { useEffect, useState } from "react";
import { Table } from "semantic-ui-react";
import axios from "axios";
import { useAuth0 } from "../components/Auth0Provider";

const ListProblems: React.FC = props => {
  const { isAuthenticated, getTokenSilently } = useAuth0() as any;
  const [problems, setProblems] = useState([]);

  useEffect(() => {
    (async () => {
      if (!isAuthenticated) {
        return;
      }

      const result = await axios.get(
        `${process.env.REACT_APP_API_ENDPOINT}/problems/drafts`,
        {
          headers: {
            Authorization: `Bearer ${await getTokenSilently()}`
          }
        }
      );

      console.log(result.data);
      if (result.data) {
        setProblems(result.data);
      }
    })();
  }, [isAuthenticated]);

  return (
    <Table celled compact>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>問題タイトル</Table.HeaderCell>
          <Table.HeaderCell>更新日時</Table.HeaderCell>
          <Table.HeaderCell />
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {problems.map(problem => (
          <Table.Row key={problem.updated_at}>
            <Table.Cell>{problem.title}</Table.Cell>
            <Table.Cell>{problem.updated_at}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

export default ListProblems;
