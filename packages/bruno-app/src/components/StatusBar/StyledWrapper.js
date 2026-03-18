import styled from 'styled-components';

const StyledWrapper = styled.div`
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    height: 1.5rem;
    background: ${(props) => props.theme.sidebar.bg};
    border-top: 1px solid ${(props) => props.theme.statusBar.border};
    color: ${(props) => props.theme.statusBar.color};
    font-size: ${(props) => props.theme.font.size.sm};
    user-select: none;
    position: relative;
  }

  .status-bar-section {
    display: flex;
    align-items: center;
    position: relative;
  }

  .status-bar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .status-bar-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    cursor: pointer;
    position: relative;
    outline: none;
  }

  .status-bar-button:hover {
    background: ${(props) => props.theme.dropdown?.hover || `${props.theme.statusBar.border}55`};
    border-radius: 4px;
  }

  .console-button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    position: relative;
  }

  .console-label {
    white-space: nowrap;
  }

  .error-count-inline {
    font-size: 10px;
    font-weight: 500;
    color: ${(props) => props.theme.colors.text.danger};
    background: ${(props) => props.theme.colors.bg.danger}20;
    padding: 1px 4px;
    border-radius: 4px;
  }

  .status-bar-divider {
    width: 1px;
    height: 16px;
    background: ${(props) => props.theme.sidebar.dragbar};
    opacity: 0.4;
  }

  .status-bar-version {
    display: flex;
    align-items: center;
    padding: 2px 6px;
  }

  .git-status-button {
    border-radius: 999px;
    padding: 1px 8px;
    margin-right: 2px;
    border: 1px solid transparent;
  }

  .git-status-busy {
    position: relative;
    overflow: hidden;
  }

  .git-status-busy::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 20%, rgba(255, 255, 255, 0.35) 50%, transparent 80%);
    transform: translateX(-120%);
    animation: git-status-shimmer 1.1s linear infinite;
    pointer-events: none;
  }

  .git-status-synced {
    color: #0f8a4b;
    background: rgba(15, 138, 75, 0.12);
    border-color: rgba(15, 138, 75, 0.25);
  }

  .git-status-ahead {
    color: #1463c1;
    background: rgba(20, 99, 193, 0.12);
    border-color: rgba(20, 99, 193, 0.25);
  }

  .git-status-behind {
    color: #a15a00;
    background: rgba(161, 90, 0, 0.12);
    border-color: rgba(161, 90, 0, 0.25);
  }

  .git-status-dirty {
    color: #8f2d56;
    background: rgba(143, 45, 86, 0.12);
    border-color: rgba(143, 45, 86, 0.25);
  }

  .git-status-error {
    color: #b42318;
    background: rgba(180, 35, 24, 0.12);
    border-color: rgba(180, 35, 24, 0.25);
  }

  .git-status-disabled {
    color: ${(props) => props.theme.statusBar.color};
    background: rgba(128, 128, 128, 0.12);
    border-color: rgba(128, 128, 128, 0.2);
  }

  .git-dropdown-header {
    min-width: 260px;
    padding: 2px 0;
  }

  .git-dropdown-title {
    font-weight: 600;
    margin-bottom: 6px;
  }

  .git-dropdown-meta {
    font-size: 12px;
    opacity: 0.9;
    line-height: 1.5;
  }

  .git-dropdown-error {
    margin-top: 6px;
    color: #b42318;
  }

  @keyframes git-status-shimmer {
    from {
      transform: translateX(-120%);
    }

    to {
      transform: translateX(120%);
    }
  }
`;

export default StyledWrapper;
