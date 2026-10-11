import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import MaterialsPage from './page';
const state=vi.hoisted(()=>({create:vi.fn(),remove:vi.fn()}));
vi.mock('@/src/services/api/laboratory/materialApi',()=>({
 useGetMaterialsQuery:()=>({data:[{id:'zirconia',name:'Цирконий',unit:'шт',isActive:true}],isLoading:false,isError:false}),
 useCreateMaterialMutation:()=>[state.create,{isLoading:false}],useDeleteMaterialMutation:()=>[state.remove],
}));
beforeEach(()=>{state.create.mockReset();state.create.mockReturnValue({unwrap:()=>Promise.resolve()});});
it('opens a standalone dictionary and submits the backend catalogue fields',async()=>{
 render(<MaterialsPage/>);expect(screen.getByText(/Цирконий/)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Диск'}});
 fireEvent.change(screen.getByLabelText('Артикул'),{target:{value:'ZIR-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Добавить'}));
 await waitFor(()=>expect(state.create).toHaveBeenCalledWith({name:'Диск',nomenclatureCode:'ZIR-01',unit:'шт',description:''}));
});
it('preserves entered data and shows an error when saving fails',async()=>{
 state.create.mockReturnValue({unwrap:()=>Promise.reject()});render(<MaterialsPage/>);
 fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Диск'}});
 fireEvent.change(screen.getByLabelText('Артикул'),{target:{value:'ZIR-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Добавить'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось добавить');
 expect(screen.getByLabelText('Название')).toHaveValue('Диск');
});
