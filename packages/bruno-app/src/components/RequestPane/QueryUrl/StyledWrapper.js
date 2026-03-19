import styled from 'styled-components';

const Wrapper = styled.div`
  height: 2.6rem;
  border: ${(props) => props.theme.requestTabPanel.url.border};
  border-radius: ${(props) => props.theme.border.radius.base};
  padding-right: 0.5rem;

  .infotip {
    position: relative;
    display: inline-block;
    cursor: pointer;
  }

  .infotip:hover .infotiptext {
    visibility: visible;
    opacity: 1;
  }

  .infotiptext {
    visibility: hidden;
    width: auto;
    background-color: ${(props) => props.theme.background.surface2};
    color: ${(props) => props.theme.text};
    text-align: center;
    border-radius: 4px;
    padding: 4px 8px;
    position: absolute;
    z-index: 1;
    bottom: 34px;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s;
    white-space: nowrap;
  }

  .infotiptext::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -4px;
    border-width: 4px;
    border-style: solid;
    border-color: ${(props) => props.theme.background.surface2} transparent transparent transparent;
  }

  .shortcut {
    font-size: 0.625rem;
  }

  .query-url-actions {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    height: 100%;
    margin-left: 0.5rem;
  }

  .action-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: ${(props) => props.theme.border.radius.base};
    transition: background-color 0.15s ease, transform 0.15s ease;
  }

  .action-icon-button:hover {
    background: ${(props) => props.theme.background.surface2};
  }

  .request-action-button button {
    min-width: 7rem;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  }

  .request-send-button button {
    padding-left: 1rem;
    padding-right: 1.1rem;
  }

  .request-cancel-button button {
    padding-left: 0.95rem;
    padding-right: 1rem;
  }
`;

export default Wrapper;
