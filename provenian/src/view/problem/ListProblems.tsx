import React from "react";
import { Table } from "semantic-ui-react";
import { Link } from "react-router-dom";

const ListProblems: React.FC<{ problems: any[] }> = props => {
  return (
    <Table celled compact>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>問題タイトル</Table.HeaderCell>
          <Table.HeaderCell>更新日時</Table.HeaderCell>
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {props.problems.map(problem => (
          <Table.Row key={problem.updated_at}>
            <Table.Cell>
              <Link to={`/problems/${problem.id}/draft`}>{problem.title}</Link>
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
