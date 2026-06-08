import styled from 'styled-components';

const StyledWrapper = styled.div`
  height: 2.1rem;

  .url-bar-container {
    border: ${(props) => props.theme.requestTabPanel.url.border};
    border-radius: ${(props) => props.theme.border.radius.base};
    height: 100%;
  }
`;

export default StyledWrapper;
