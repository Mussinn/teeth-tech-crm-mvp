import {useDroppable} from "@dnd-kit/core";
import type {KanbanColumn} from "@/src/types/task.types";

type DroppableColumnProps = {
    id: KanbanColumn<string>['id'];
    column: KanbanColumn<string>;
    children: React.ReactNode;
};


export default function DroppableColumn({ id, column, children }: DroppableColumnProps) {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`flex h-fit min-h-[280px] w-full min-w-[15rem] flex-col rounded-xl border border-slate-200 border-t-4 bg-slate-100 ${column.color} shadow-inner`}
        >
            {children}
        </div>
    );
}
