import React from "react";
import { Segment, Menu, Dropdown, Image } from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useAuth0 } from "../components/Auth0Provider";

const NavBar = () => {
  const {
    isAuthenticated,
    loginWithRedirect,
    logout,
    loading,
    user,
    isWriter
  } = useAuth0() as any;

  const authMenuItem = () => {
    if (!isAuthenticated) {
      return (
        <Menu.Item onClick={() => loginWithRedirect({})}>
          新規登録/ログイン
        </Menu.Item>
      );
    } else {
      const { nickname, picture } = user;

      const userElement = (
        <>
          <Image avatar src={picture} /> {nickname}
        </>
      );

      return (
        <Dropdown item trigger={userElement}>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => logout()}>ログアウト</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      );
    }
  };

  return (
    <Segment>
      <Menu fixed="top" inverted={true}>
        <Menu.Item>
          <Link to={"/"}>Provenian</Link>
        </Menu.Item>

        <Menu.Menu position="right">
          {isWriter && (
            <>
              <Menu.Item>
                <Link to={"/me/problems"}>自作の問題</Link>
              </Menu.Item>
              <Menu.Item>
                <Link to={"/problem/new"}>問題を作る</Link>
              </Menu.Item>
            </>
          )}

          {!loading && authMenuItem()}
        </Menu.Menu>
      </Menu>
    </Segment>
  );
};

export default NavBar;
