import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: relative;
  
  .menu-icon {
    display: flex;
    align-items: center;
    color: ${(props) => props.theme.sidebar.dropdownIcon.color};
    visibility: hidden;

    .dropdown {
      div[aria-expanded='true'] {
        visibility: visible;
      }
      div[aria-expanded='false'] {
        visibility: visible;
      }
    }
  }

  .send-icon {
    color: ${(props) => props.theme.sidebar.dropdownIcon.color};
    visibility: hidden;
    margin-right: 0.25rem;
  }

  .collection-item-name {
    height: 1.6rem;
    cursor: pointer;
    user-select: none;
    position: relative;

    span.item-name {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    &:hover,
    &.item-hovered {
      background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
      .send-icon,
      .menu-icon {
        visibility: visible;
      }
    }

    &.item-focused-in-tab {
      background: ${(props) => props.theme.sidebar.collection.item.bg};

      &:hover {
        background: ${(props) => props.theme.sidebar.collection.item.bg} !important;
      }
    }
  }

  .example-icon {
    color: ${(props) => props.theme.sidebar.collection.item.example.iconColor};
  }

`;

export default StyledWrapper;
