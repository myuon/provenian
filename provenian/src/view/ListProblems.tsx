import React, { useEffect, useState } from "react";
import { Table } from "semantic-ui-react";
import axios from "axios";
import { useAuth0 } from "../components/Auth0Provider";
import { Link } from "react-router-dom";

const ListProblems: React.FC<{ draft: boolean }> = props => {
  const { isAuthenticated, getTokenSilently } = useAuth0() as any;
  const [problems, setProblems] = useState([]);

  useEffect(() => {
    (async () => {
      if (!props.draft) {
        const result = await axios.get(
          `${process.env.REACT_APP_FILE_STORAGE}/index.json`
        );

        setProblems(result.data);
      } else {
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

        if (result.data) {
          setProblems(result.data);
        }
      }
    })();
  }, [isAuthenticated, props.draft]);

  return (
    <Table celled compact>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>問題タイトル</Table.HeaderCell>
          <Table.HeaderCell>更新日時</Table.HeaderCell>
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {problems.map(problem => (
          <Table.Row key={problem.updated_at}>
            <Table.Cell>
              <Link to={`${props.draft ? "/me" : ""}/problems/${problem.id}`}>
                {problem.title}
              </Link>
            </Table.Cell>
            <Table.Cell>
              {new Date(problem.updated_at * 1000).toLocaleString()}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
};

export default ListProblems;
