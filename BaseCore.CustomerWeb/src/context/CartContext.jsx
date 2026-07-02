import { createContext, useContext, useReducer, useState, useEffect, useCallback } from 'react';
import { cartService } from '../services/cart/cartService';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

function cartReducer(state, action) {
  switch (action.type) {
    case 'SET_CART':
      return action.payload;
    case 'ADD': {
      const quantity = Math.max(1, Number(action.item.quantity) || 1);
      // Ghép key bằng productId + selectedGender để phân biệt đực/cái/cặp
      const key = `${action.item.productId}-${action.item.selectedGender ?? ''}`;
      const exists = state.find(i =>
        `${i.productId}-${i.selectedGender ?? ''}` === key
      );
      if (exists)
        return state.map(i =>
          `${i.productId}-${i.selectedGender ?? ''}` === key
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      return [...state, { ...action.item, quantity }];
    }
    case 'REMOVE':
      return state.filter(i => i.id !== action.id);
    case 'SET_QTY':
      return state.map(i =>
        i.id === action.id
          ? { ...i, quantity: Math.max(1, action.qty) }
          : i
      );
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

const mapCartItems = (items) =>
  items.map(i => ({
    id: i.id,
    productId: i.productId,
    name: i.productName,
    price: i.price,
    quantity: i.quantity,
    availableStock: i.availableStock ?? null,
    image: i.imageUrl,
    selectedGender: i.selectedGender ?? null,
    phMin: i.phMin ?? null,
    phMax: i.phMax ?? null,
    tempMin: i.tempMin ?? null,
    tempMax: i.tempMax ?? null,
    compatibility: i.compatibility ?? null,
  }));

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const isAuthenticated = !!user?.token;

  useEffect(() => {
    if (!isAuthenticated) {
      dispatch({ type: 'CLEAR' });
      return;
    }

    const loadCart = async () => {
      setIsLoading(true);
      try {
        const data = await cartService.getCart();
        if (data && data.items) {
          dispatch({ type: 'SET_CART', payload: mapCartItems(data.items) });
        }
      } catch (err) {
        console.error('Failed to load cart:', err);
        setError('Không thể tải giỏ hàng');
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, [isAuthenticated]);

  // item phải có selectedGender khi sản phẩm có phân giới tính
  const add = useCallback(async (item, selectedGender = null, quantity = 1) => {
    const productId = item.productId || item.id;
    if (!productId) {
      setError('Sản phẩm không có mã ID');
      return { ok: false, message: 'Sản phẩm không có mã ID' };
    }
    const requestedQuantity = Math.max(1, Number(quantity) || 1);
    const normalizedItem = {
      id: null, // sẽ được cập nhật sau khi API trả về
      productId,
      name: item.name || item.productName || '',
      price: item.price || 0,
      image: item.image || item.imageUrl || '',
      quantity: requestedQuantity,
      selectedGender,
    };

    dispatch({ type: 'ADD', item: normalizedItem });

    try {
      setIsLoading(true);
      const data = await cartService.addItem(productId, requestedQuantity, selectedGender);
      // Đồng bộ lại với server để lấy đúng id
      if (data && data.items) {
        dispatch({ type: 'SET_CART', payload: mapCartItems(data.items) });
      }
      setError(null);
      return { ok: true };
    } catch (err) {
      try {
        const data = await cartService.getCart();
        dispatch({ type: 'SET_CART', payload: mapCartItems(data.items) });
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      setError(err.message || 'Thêm sản phẩm thất bại');
      return { ok: false, message: err.message || 'Thêm sản phẩm thất bại' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const remove = useCallback(async (itemId) => {
    if (!itemId) return;
    dispatch({ type: 'REMOVE', id: itemId });
    try {
      setIsLoading(true);
      await cartService.removeItem(itemId);
      setError(null);
    } catch (err) {
      try {
        const data = await cartService.getCart();
        dispatch({ type: 'SET_CART', payload: mapCartItems(data.items) });
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      setError(err.message || 'Xóa sản phẩm thất bại');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setQty = useCallback(async (itemId, qty) => {
    if (!itemId) return;
    dispatch({ type: 'SET_QTY', id: itemId, qty });
    try {
      setIsLoading(true);
      await cartService.updateQuantity(itemId, qty);
      setError(null);
    } catch (err) {
      try {
        const data = await cartService.getCart();
        dispatch({ type: 'SET_CART', payload: mapCartItems(data.items) });
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      setError(err.message || 'Cập nhật số lượng thất bại');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      setIsLoading(true);
      await cartService.clearCart();
      dispatch({ type: 'CLEAR' });
      setError(null);
    } catch (err) {
      setError(err.message || 'Xóa giỏ hàng thất bại');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, add, remove, setQty, clear, total, count, isLoading, error }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
