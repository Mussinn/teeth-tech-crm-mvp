import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import Statuses from './page';
const state=vi.hoisted(()=>({data: [] as Array<{id:string;code:string;name:string;active:boolean}>, toggle:vi.fn()}));
vi.mock('@/src/services/api/workflowApi',()=>({
 useGetOrderStatusesQuery:()=>({data:state.data,isLoading:false,isError:false}),
 useSetStatusActiveMutation:()=>[state.toggle,{isLoading:false}],
 useCreateOrderStatusMutation:()=>[vi.fn(),{isLoading:false}],
 useDeleteOrderStatusMutation:()=>[vi.fn(),{isLoading:false}],
}));
beforeEach(()=>{state.data=[];state.toggle.mockReset();state.toggle.mockReturnValue({unwrap:()=>Promise.resolve()});});
describe('Statuses configuration',()=>{
 it('shows empty working stages and keeps system statuses protected',()=>{
 state.data=[{id:'system',code:'TODO',name:'Новая задача',active:true}];render(<Statuses/>);
 expect(screen.getByText(/Рабочих этапов пока нет/)).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Отключить'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Удалить'})).not.toBeInTheDocument();
 });
 it('activates a disabled stage',async()=>{
 state.data=[{id:'custom',code:'MODEL',name:'Модель',active:false}];render(<Statuses/>);
 fireEvent.click(screen.getByRole('button',{name:'Активировать'}));
 await waitFor(()=>expect(state.toggle).toHaveBeenCalledWith({id:'custom',active:true}));
 });
 it('shows the reason a stage cannot be disabled',async()=>{
 state.data=[{id:'custom',code:'MODEL',name:'Модель',active:true}];
 state.toggle.mockReturnValue({unwrap:()=>Promise.reject({data:{message:'На этом этапе есть задачи'}})});
 render(<Statuses/>);fireEvent.click(screen.getByRole('button',{name:'Отключить'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('На этом этапе есть задачи');
 });
});
