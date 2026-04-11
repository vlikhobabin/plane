import type { ReactElement, ReactNode, RefObject } from "react";
import type { TIssue } from "@plane/types";

type TQuickActionPlacement =
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end"
  | "right"
  | "right-start"
  | "right-end";

export interface IQuickActionProps {
  parentRef: RefObject<HTMLElement>;
  issue: TIssue;
  handleDelete: () => Promise<void>;
  handleUpdate?: (data: TIssue) => Promise<void>;
  handleRemoveFromView?: () => Promise<void>;
  handleArchive?: () => Promise<void>;
  handleRestore?: () => Promise<void>;
  handleMoveToIssues?: () => Promise<void>;
  customActionButton?: ReactElement;
  portalElement?: HTMLDivElement | null;
  readOnly?: boolean;
  placements?: TQuickActionPlacement;
}

export type TRenderQuickActions = ({
  issue,
  parentRef,
  customActionButton,
  placement,
  portalElement,
}: {
  issue: TIssue;
  parentRef: RefObject<HTMLElement>;
  customActionButton?: ReactElement;
  placement?: TQuickActionPlacement;
  portalElement?: HTMLDivElement | null;
}) => ReactNode;
